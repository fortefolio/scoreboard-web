import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Metadata } from "next";
import MatchDetailClient from "./MatchDetailClient";

type Props = {
  params: Promise<{ matchId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { matchId } = await params;
  
  // Fetch live match data from Supabase
  const { data: match } = await supabase
    .from('matches')
    .select('participants, scores, tournaments(name)')
    .eq('id', matchId)
    .single();

  if (!match) return { title: 'Match Not Found' };

  const p1 = match.participants?.[0]?.name || "TBD";
  const p2 = match.participants?.[1]?.name || "TBD";
  const sets = match.scores?.sets || [0, 0];

  const title = `${p1} vs ${p2} | ${match.tournaments?.name || 'ScoreBoard'}`;
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

export default function MatchDetailsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white bg-gray-950 min-h-screen text-center">Loading Match...</div>}>
      <MatchDetailClient />
    </Suspense>
  );
}
