"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

function ParticipantsContent() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const tournamentId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    const fetchData = async () => {
      if (!tournamentId) return;

      const { data: tData } = await supabase
        .from("tournaments")
        .select("name, sport_type, settings")
        .eq("id", tournamentId)
        .single();
      
      if (tData) setTournament(tData);

      const { data: pData } = await supabase
        .from("tournament_participants")
        .select("name")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true });
      
      if (pData) setParticipants(pData);
      setLoading(false);
    };

    fetchData();

    let channel: any = null;
    try {
      channel = supabase
        .channel(`public-participants-${tournamentId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` }, 
          () => fetchData()
        );

      channel.subscribe();
    } catch (err) {
      console.warn('[TournamentTeams] Realtime unavailable:', err);
    }

    return () => { 
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans p-4 sm:p-6 flex flex-col items-center">
      <main className="w-full max-w-2xl relative z-10 pt-8 pb-12">
        <header className="text-center mb-8">
          <Link href={`/tournament/${tournamentId}/signup`} className="text-xl font-digital text-text-primary tracking-wider mb-4 inline-block hover:opacity-80 transition-opacity">
            SCORE:BOARD
          </Link>
          <p className="text-text-muted font-medium text-xs uppercase tracking-wider mb-1.5">
            {getSportTranslation(tournament?.sport_type, t)} Roster
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3">
            {tournament?.name}
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container rounded-md border border-outline-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
            <span className="text-[11px] font-mono font-medium text-text-secondary">
              {participants.length} / {tournament?.settings?.max_teams || 16} Teams Registered
            </span>
          </div>
        </header>

        <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
          {participants.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-xs italic">
              No teams have registered yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participants.map((p, idx) => (
                <div key={idx} className="bg-surface-container-high p-3.5 rounded-xl border border-outline-variant flex items-center gap-3">
                  <span className="text-xs font-mono font-medium text-text-muted">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-medium text-text-primary text-sm truncate">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link 
            href={`/tournament/${tournamentId}/signup`}
            className="text-primary hover:underline text-xs font-medium inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">how_to_reg</span>
            Back to Registration
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function PublicParticipantsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ParticipantsContent />
    </Suspense>
  );
}
