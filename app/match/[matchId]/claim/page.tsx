"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "sonner";

export default function ClaimUmpirePage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const fetchMatch = async () => {
      const { data: { user: currUser } } = await supabase.auth.getUser();
      setUser(currUser);

      const { data } = await supabase
        .from("matches")
        .select("*, tournaments(*)")
        .eq("id", matchId)
        .single();
      
      if (data) setMatch(data);
      setLoading(false);
    };
    fetchMatch();
  }, [matchId]);

  const handleClaim = async () => {
    if (!user) {
      toast.error("Please sign in to claim the umpire role.");
      return;
    }

    setClaiming(true);
    const { error } = await supabase
      .from("matches")
      .update({ umpire_id: user.id })
      .eq("id", matchId);

    if (error) {
      toast.error("Error claiming role: " + error.message);
      setClaiming(false);
    } else {
      toast.success("You are now the official umpire for this match!");
      router.push(`/match/${matchId}`);
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>;

  if (!match) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Match not found.</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 shadow-2xl text-center">
        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
          <span className="material-symbols-outlined text-4xl text-indigo-400">shield_person</span>
        </div>
        
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-4">Claim Umpire Role</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          You have been invited to officiate the match between <span className="text-white font-bold">"{match.participants?.[0]?.name || "TBD"}"</span> and <span className="text-white font-bold">"{match.participants?.[1]?.name || "TBD"}"</span> in <span className="text-indigo-400 font-bold">{match.tournaments?.name}</span>.
        </p>

        {match.umpire_id && match.umpire_id !== user?.id && (
          <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-500 text-xs font-bold uppercase tracking-widest">
            ⚠️ This match already has an umpire. Claiming will replace them.
          </div>
        )}

        {!user ? (
          <div className="space-y-4">
             <p className="text-xs text-gray-500 italic">You must be logged in to claim this role.</p>
             <Link href="/" className="block w-full py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl font-bold transition-all">
                Go to Dashboard / Sign In
             </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {claiming ? "Claiming..." : "Confirm & Claim Role"}
            </button>
            <Link 
              href={`/match/${matchId}`}
              className="block w-full py-4 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Cancel
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
