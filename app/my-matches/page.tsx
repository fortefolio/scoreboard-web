"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function MyMatchesPage() {
  const { user, supabase } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyMatches = useCallback(async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("*, tournaments(name)")
      .eq("umpire_id", userId)
      .order("created_at", { ascending: false });

    if (data) setMatches(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) fetchMyMatches(user.id);
  }, [user, fetchMyMatches]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-on-background p-8 pt-24 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter leading-none mb-4">
          My <span className="text-primary">Matches</span>
        </h1>
        <p className="text-on-surface-variant text-xl max-w-xl">Matches assigned to you for scoring or participation.</p>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-on-surface-variant font-label uppercase tracking-widest text-[10px]">Synchronizing Matches...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {matches.map((match) => (
            <Link key={match.id} href={`/match/${match.id}`} className="group">
              <div className="bg-surface-container-low p-8 rounded-[2.5rem] border border-outline-variant/10 hover:border-primary/40 transition-all duration-500 shadow-xl relative overflow-hidden flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-widest">{match.tournaments?.name}</span>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      match.status === 'completed' ? 'bg-secondary/10 text-secondary' : 'bg-amber-500/10 text-amber-500'
                    }`}>
                      {match.status}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {[0, 1].map((i) => (
                      <div key={i} className="flex justify-between items-center pr-2">
                        <span className="text-lg font-bold text-on-surface truncate max-w-[180px]">{match.participants?.[i]?.name || "TBD"}</span>
                        <span className="text-2xl font-digital text-primary">{match.current_score?.final_sets?.[i] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Round {match.round_number}</span>
                  <div className="flex items-center gap-2 text-primary group-hover:translate-x-1 transition-transform">
                    <span className="text-[10px] font-black uppercase tracking-widest">Enter Arena</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {matches.length === 0 && (
            <div className="col-span-full border-2 border-dashed border-outline-variant/20 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-on-surface-variant bg-surface-container-low/30">
              <span className="material-symbols-outlined text-5xl mb-6 opacity-20">sports_tennis</span>
              <p className="font-black uppercase tracking-widest text-sm mb-2">No matches found</p>
              <p className="text-[10px] uppercase font-bold tracking-tighter opacity-60">You haven't been assigned to any matches yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
