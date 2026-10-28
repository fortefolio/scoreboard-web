"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

function SignupContent() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [teamName, setTeamName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [formResponses, setFormResponses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const tournamentId = Array.isArray(id) ? id[0] : id;

  const buildInitialFormResponses = (schema: any[] = []) => {
    const initialData: Record<string, any> = {};
    schema.forEach((field: any) => {
      if (field.type === 'checkbox') initialData[field.id] = false;
      else initialData[field.id] = "";
    });
    return initialData;
  };

  useEffect(() => {
    if (tournamentId) {
      const fetchTournament = async () => {
        const { data } = await supabase
          .from("tournaments")
          .select("name, sport_type, status, settings, signup_schema")
          .eq("id", tournamentId)
          .single();

        if (data) {
          setTournament(data);
          setFormResponses(buildInitialFormResponses(data.signup_schema || []));
        }

        const { count } = await supabase
          .from("tournament_participants")
          .select("id", { count: 'exact', head: true })
          .eq("tournament_id", tournamentId);
        
        setParticipantCount(count || 0);
        setLoading(false);
      };
      fetchTournament();
    }
  }, [tournamentId]);

  const maxTeams = tournament?.settings?.max_teams ?? tournament?.settings?.stage_1?.max_teams ?? 16;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !contactEmail.trim()) return;
    if (tournament?.status !== 'pending') {
      toast.error("Signups are closed for this tournament.");
      return;
    }

    if (participantCount >= maxTeams) {
      toast.error("This tournament has reached its maximum number of teams.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tournament_participants")
        .insert({
          tournament_id: tournamentId,
          name: teamName.trim(),
          contact_email: contactEmail.trim(),
          form_responses: formResponses
        });

      if (error) throw error;

      setParticipantCount((prev) => prev + 1);
      setSuccess(true);
      toast.success("Successfully registered for the tournament!");
    } catch (err: any) {
      toast.error(`Registration failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl font-headline font-black mb-4">Tournament Not Found</h1>
        <p className="text-on-surface-variant mb-8">The tournament you are looking for does not exist or has been removed.</p>
        <Link href="/" className="bg-primary-container text-on-primary-container px-8 py-3 rounded-xl font-bold">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container flex flex-col items-center justify-center p-6">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary-container/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary-container/5 rounded-full blur-[120px]"></div>
      </div>

      <main className="w-full max-w-md relative z-10">
        <header className="text-center mb-12">
          <div className="text-2xl font-digital text-indigo-500 tracking-tighter mb-8">SCORE:BOARD</div>
          <p className="text-secondary font-label text-[10px] uppercase tracking-[0.3em] mb-2">{getSportTranslation(tournament.sport_type, t)} Registration</p>
          <h1 className="text-4xl font-headline font-black tracking-tight">{tournament.name}</h1>
        </header>

        {success ? (
          <div className="bg-surface-container-low rounded-[2rem] p-10 border border-emerald-500/20 shadow-3xl text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
            </div>
            <h2 className="text-2xl font-headline font-black mb-4 text-on-surface">You're In!</h2>
            <p className="text-on-surface-variant text-sm mb-8">
              <span className="font-bold text-on-surface">"{teamName}"</span> has been registered for this tournament. Check the live bracket to see when matches start.
            </p>
            <div className="flex flex-col gap-4">
              <Link href={`/tournament/${tournamentId}/teams`} className="w-full bg-surface-container-high py-4 rounded-xl font-bold text-sm border border-outline-variant/10 hover:bg-surface-bright transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">groups</span>
                View Registered Teams
              </Link>
              <button 
                onClick={() => {
                  setTeamName("");
                  setContactEmail("");
                  setFormResponses(buildInitialFormResponses(tournament?.signup_schema || []));
                  setSuccess(false);
                }}
                className="text-primary font-bold text-sm hover:underline"
              >
                Register another team
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-[2rem] p-10 border border-outline-variant/10 shadow-3xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50"></div>
            
            <form onSubmit={handleSignup} className="relative z-10 space-y-6">
              {participantCount >= maxTeams ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-3xl text-amber-500">lock</span>
                  </div>
                  <h2 className="text-xl font-headline font-black mb-2 text-on-surface">Tournament Full</h2>
                  <p className="text-on-surface-variant text-xs mb-6 px-4">
                    The maximum number of teams ({maxTeams}) has already registered for this tournament.
                  </p>
                  <Link href={`/tournament/${tournamentId}/teams`} className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    View Registered Teams
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Team or Player Name</label>
                    <input 
                      autoFocus
                      required
                      className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/30"
                      placeholder="e.g. Lisbon Masters"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">Contact Email</label>
                    <input 
                      required
                      type="email"
                      className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/30"
                      placeholder="manager@team.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  {/* Dynamic Fields */}
                  {(tournament.signup_schema || []).map((field: any) => (
                    <div key={field.id}>
                      <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-3">
                        {field.label} {field.required && <span className="text-primary">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select 
                          required={field.required}
                          className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-none"
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                        >
                          <option value="" disabled>Select an option</option>
                          {(field.options || []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <div className="flex items-center gap-3 px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10">
                          <input 
                            type="checkbox"
                            required={field.required}
                            className="w-6 h-6 rounded bg-surface-container-highest border-none text-primary focus:ring-0"
                            checked={formResponses[field.id] || false}
                            onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.checked })}
                          />
                          <span className="text-on-surface-variant text-sm font-medium">{field.description || `I agree to ${field.label}`}</span>
                        </div>
                      ) : (
                        <input 
                          required={field.required}
                          type={field.type}
                          min={field.type === 'number' && field.min != null ? field.min : undefined}
                          max={field.type === 'number' && field.max != null ? field.max : undefined}
                          className="w-full px-6 py-5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold text-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant/30"
                          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                        />
                      )}
                    </div>
                  ))}

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={submitting || tournament.status !== 'pending'}
                      className="w-full bg-primary-container text-on-primary-container py-5 rounded-full font-black uppercase tracking-[0.2em] text-xs hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">how_to_reg</span>
                          Register for Tournament
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
              {tournament.status !== 'pending' && participantCount < (tournament?.settings?.max_teams || 16) && (
                <p className="text-center text-[10px] font-bold text-red-400 uppercase tracking-widest">
                  Signups are currently closed
                </p>
              )}
            </form>
          </div>
        )}

        <footer className="mt-12 text-center opacity-30">
          <p className="font-label text-[10px] uppercase tracking-[0.5em] text-on-surface-variant">Powered by ScoreBoard Scoring Engine</p>
        </footer>
      </main>
    </div>
  );
}

export default function TournamentSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
