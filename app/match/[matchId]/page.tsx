import { Suspense } from "react";
import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { countSetsWon, extractSetsData } from "@/lib/scoring/sets";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import MatchDetailClient from "./MatchDetailClient";

type Props = {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const { url, anonKey } = supabaseEnv();
  const supabase = createClient(url, anonKey);

  const { data: match } = await supabase
    .from('matches')
    .select('participants, scores, tournaments(name)')
    .eq('id', matchId)
    .single();

  if (!match) {
    return {
      title: 'Match Not Found',
      description: 'Follow live matches, tournaments, and scores on ScoreBoard.',
    };
  }

  const p1 = formatTeamOrPlayerName(match.participants?.[0]?.name) || "TBD";
  const p2 = formatTeamOrPlayerName(match.participants?.[1]?.name) || "TBD";
  const parsedSets = extractSetsData(match.scores);
  const sets =
    parsedSets.length > 0
      ? [countSetsWon(parsedSets, 0), countSetsWon(parsedSets, 1)]
      : [match.scores?.current?.home ?? 0, match.scores?.current?.away ?? 0];

  const tournament = Array.isArray(match.tournaments) ? match.tournaments[0] : match.tournaments;
  const title = tournament?.name ? `${p1} vs ${p2} | ${tournament.name}` : `${p1} vs ${p2}`;
  const description = `Live Score: ${sets[0]} - ${sets[1]}. Follow ${p1} vs ${p2}${tournament?.name ? ` (${tournament.name})` : ""} with real-time play-by-play scores and match stats on ScoreBoard.`;
  const ogImageUrl = `/api/og/match?id=${matchId}`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "ScoreBoard",
      title,
      description,
      url: `https://score-board.net/match/${matchId}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${p1} vs ${p2}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

async function MatchDetailsLoader({ params }: Props) {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();

  const [matchRes, eventsRes] = await Promise.all([
    supabase
      .from("matches")
      .select("*, tournaments(*)")
      .eq("id", matchId)
      .single(),
    supabase
      .from("match_events")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true }),
  ]);

  let initialMatch: any = null;
  const mData = matchRes.data;

  if (mData && !matchRes.error) {
    const ownerId = mData.organizer_id || mData.tournaments?.organizer_id;
    const needOrganizerFetch = Boolean(ownerId && ownerId !== mData.umpire_id);

    const [umpireRes, organizerRes] = await Promise.all([
      mData.umpire_id
        ? supabase.from("users").select("id, username").eq("id", mData.umpire_id).single()
        : Promise.resolve({ data: null }),
      needOrganizerFetch
        ? supabase.from("users").select("id, username").eq("id", ownerId).single()
        : Promise.resolve({ data: null }),
    ]);

    const umpireData = umpireRes.data ?? null;
    const organizerData =
      ownerId && ownerId === mData.umpire_id ? umpireData : (organizerRes.data ?? null);

    initialMatch = { ...mData, umpire: umpireData, organizer: organizerData };
  }

  return (
    <MatchDetailClient
      initialMatch={initialMatch}
      initialEvents={eventsRes.data ?? []}
    />
  );
}

export default function MatchDetailsPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Match...</div>}>
      <MatchDetailsLoader params={params} />
    </Suspense>
  );
}
