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
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-primary selection:text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <main className="w-full max-w-md relative z-10">
        <header className="text-center mb-8">
          <Link href="/" className="text-xl font-digital text-text-primary tracking-wider mb-4 inline-block hover:opacity-80 transition-opacity">
            SCORE:BOARD
          </Link>
          <p className="text-text-muted font-medium text-xs uppercase tracking-wider mb-1.5">
            {getSportTranslation(tournament.sport_type, t)} Registration
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            {tournament.name}
          </h1>
        </header>

        {success ? (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant text-center animate-in fade-in duration-300">
            <div className="w-12 h-12 bg-success/10 border border-success/20 rounded-full flex items-center justify-center mx-auto mb-4 text-success">
              <span className="material-symbols-outlined text-2xl">check_circle</span>
            </div>
            <h2 className="text-lg font-semibold mb-2 text-text-primary">Registration Confirmed</h2>
            <p className="text-text-muted text-xs mb-6 leading-relaxed">
              <span className="font-semibold text-text-primary">"{teamName}"</span> has been registered for this tournament. Check the live bracket to see when matches start.
            </p>
            <div className="flex flex-col gap-3">
              <Link 
                href={`/tournament/${tournamentId}/teams`} 
                className="w-full bg-surface-container-high hover:bg-surface-container-highest py-2.5 rounded-lg font-medium text-xs border border-outline-variant transition-colors flex items-center justify-center gap-2 text-text-primary"
              >
                <span className="material-symbols-outlined text-base">groups</span>
                View Registered Teams
              </Link>
              <button 
                onClick={() => {
                  setTeamName("");
                  setContactEmail("");
                  setFormResponses(buildInitialFormResponses(tournament?.signup_schema || []));
                  setSuccess(false);
                }}
                className="text-primary hover:underline text-xs font-medium py-1"
              >
                Register another team
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-2xl relative">
            <form onSubmit={handleSignup} className="space-y-4">
              {participantCount >= maxTeams ? (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-400">
                    <span className="material-symbols-outlined text-2xl">lock</span>
                  </div>
                  <h2 className="text-base font-semibold mb-1 text-text-primary">Tournament Full</h2>
                  <p className="text-text-muted text-xs mb-4">
                    The maximum number of teams ({maxTeams}) has already registered for this tournament.
                  </p>
                  <Link href={`/tournament/${tournamentId}/teams`} className="inline-flex items-center gap-1.5 text-primary font-medium text-xs hover:underline">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    View Registered Teams
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Team or Player Name</label>
                    <input 
                      autoFocus
                      required
                      className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
                      placeholder="e.g. Lisbon Masters"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Contact Email</label>
                    <input 
                      required
                      type="email"
                      className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
                      placeholder="manager@team.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>

                  {/* Dynamic Fields */}
                  {(tournament.signup_schema || []).map((field: any) => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-text-muted mb-1.5">
                        {field.label} {field.required && <span className="text-primary">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select 
                          required={field.required}
                          className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-primary transition-colors appearance-none"
                          value={formResponses[field.id] || ""}
                          onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                        >
                          <option value="" disabled>Select an option</option>
                          {(field.options || []).map((opt: string) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant">
                          <input 
                            type="checkbox"
                            required={field.required}
                            className="w-4 h-4 rounded bg-surface-container border-outline-variant text-primary focus:ring-0"
                            checked={formResponses[field.id] || false}
                            onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.checked })}
                          />
                          <span className="text-text-secondary text-xs font-medium">{field.description || `I agree to ${field.label}`}</span>
                        </div>
                      ) : (
                        <input 
                          required={field.required}
                          type={field.type}
                          min={field.type === 'number' && field.min != null ? field.min : undefined}
                          max={field.type === 'number' && field.max != null ? field.max : undefined}
                          className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
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
                      className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
                <p className="text-center text-xs font-medium text-error">
                  Signups are currently closed
                </p>
              )}
            </form>
          </div>
        )}

        <footer className="mt-8 text-center">
          <p className="font-mono text-xs text-text-muted">Powered by ScoreBoard Scoring Engine</p>
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
