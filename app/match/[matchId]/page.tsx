import { Suspense } from "react";
import { Metadata } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatTeamOrPlayerName } from "@/lib/utils/formatName";
import MatchDetailClient from "./MatchDetailClient";

type Props = {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: match } = await supabase
    .from('matches')
    .select('participants, scores, tournaments(name)')
    .eq('id', matchId)
    .single();

  if (!match) return { title: 'Match Not Found' };

  const p1 = formatTeamOrPlayerName(match.participants?.[0]?.name) || "TBD";
  const p2 = formatTeamOrPlayerName(match.participants?.[1]?.name) || "TBD";
  const sets = match.scores?.sets || [0, 0];

  const tournament = Array.isArray(match.tournaments) ? match.tournaments[0] : match.tournaments;
  const title = `${p1} vs ${p2} | ${tournament?.name || 'ScoreBoard'}`;
  const description = `Live Score: ${sets[0]} - ${sets[1]}. Follow the match in real-time on ScoreBoard.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://scoreboard.tennis/match/${matchId}`,
      images: [`/api/og/match?id=${matchId}`], 
    },
  };
}

export default async function MatchDetailsPage({ params }: Props) {
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
    <Suspense fallback={<div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Match...</div>}>
      <MatchDetailClient
        initialMatch={initialMatch}
        initialEvents={eventsRes.data ?? []}
      />
    </Suspense>
  );
}
