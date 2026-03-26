"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PublicParticipantsPage() {
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

    const channel = supabase
      .channel(`public-participants-${tournamentId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${tournamentId}` }, 
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body p-6 flex flex-col items-center">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/10 rounded-full blur-[120px]"></div>
      </div>

      <main className="w-full max-w-2xl relative z-10 pt-12">
        <header className="text-center mb-16">
          <Link href={`/tournament/${tournamentId}/signup`} className="text-2xl font-digital text-indigo-500 tracking-tighter mb-8 inline-block">SCORE:BOARD</Link>
          <p className="text-secondary font-label text-[10px] uppercase tracking-[0.3em] mb-2">{tournament?.sport_type} Roster</p>
          <h1 className="text-4xl font-headline font-black tracking-tight mb-4">{tournament?.name}</h1>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-surface-container-high rounded-full border border-outline-variant/10">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              {participants.length} / {tournament?.settings?.max_teams || 16} Teams Registered
            </span>
          </div>
        </header>

        <div className="bg-surface-container-low rounded-[2.5rem] p-10 border border-outline-variant/10 shadow-3xl">
          {participants.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant italic">
              No teams have registered yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {participants.map((p, idx) => (
                <div key={idx} className="bg-surface-container p-5 rounded-2xl border border-outline-variant/5 flex items-center gap-4 group hover:border-primary/30 transition-all">
                  <span className="text-[10px] font-black text-primary opacity-30 group-hover:opacity-100 transition-opacity">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-bold text-on-surface">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <Link href={`/tournament/${tournamentId}/signup`}>
            <button className="text-primary font-bold text-sm hover:underline flex items-center gap-2 mx-auto">
              <span className="material-symbols-outlined text-sm">how_to_reg</span>
              Back to Registration
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
