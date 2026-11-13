"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import SelectField from "@/components/SelectField";

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
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tournamentId = Array.isArray(id) ? id[0] : id;

  const buildInitialFormResponses = (schema: any[] = []) => {
    const initialData: Record<string, any> = {};
    schema.forEach((field: any) => {
      if (field.type === 'checkbox') initialData[field.id] = false;
      else initialData[field.id] = "";
    });
    return initialData;
  };

  const refreshParticipantCount = async () => {
    if (!tournamentId) return;
    const { count } = await supabase
      .from("tournament_participants")
      .select("id", { count: 'exact', head: true })
      .eq("tournament_id", tournamentId);
    setParticipantCount(count || 0);
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

        await refreshParticipantCount();
        setLoading(false);
      };
      fetchTournament();
    }
  }, [tournamentId]);

  const maxTeams = tournament?.settings?.max_teams ?? tournament?.settings?.stage_1?.max_teams ?? 16;
  const isFull = participantCount >= maxTeams;
  const isClosed = tournament?.status !== "pending";

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!teamName.trim() || !contactEmail.trim()) return;
    if (tournament?.status !== 'pending') {
      const msg = "Signups are closed for this tournament.";
      setSubmitError(msg);
      toast.error(msg);
      return;
    }

    if (participantCount >= maxTeams) {
      const msg = "This tournament has reached its maximum number of teams.";
      setSubmitError(msg);
      toast.error(msg);
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
      const message = err?.message || "Could not complete registration. Please try again.";
      setSubmitError(message);
      toast.error(`Registration failed: ${message}`);
      await refreshParticipantCount();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-semibold mb-2 text-text-primary">Tournament Not Found</h1>
        <p className="text-text-muted text-xs mb-6 max-w-sm">The tournament you are looking for does not exist or has been removed.</p>
        <Link href="/" className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors">
          Go Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-sans selection:bg-text-primary selection:text-surface-container-lowest flex flex-col items-center pt-10 sm:pt-14 pb-12 px-4 sm:px-6">
      <main className="w-full max-w-md relative z-10">
        <header className="text-center mb-6">
          <p className="text-text-muted font-medium text-xs uppercase tracking-wider mb-1.5">
            {getSportTranslation(tournament.sport_type, t)} Registration
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            {tournament.name}
          </h1>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container border border-outline-variant text-xs font-medium text-text-secondary">
            <span className="material-symbols-outlined text-sm text-text-muted">groups</span>
            <span>{participantCount} / {maxTeams} teams registered</span>
          </div>
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
                className="text-text-secondary hover:text-text-primary hover:underline text-xs font-medium py-1"
              >
                Register another team
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant shadow-2xl relative">
            {isFull && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
                <span className="material-symbols-outlined text-amber-400 text-lg shrink-0 mt-0.5">warning</span>
                <div className="text-xs">
                  <p className="font-semibold text-text-primary">Tournament Full</p>
                  <p className="text-text-muted mt-0.5 leading-relaxed">
                    The maximum number of teams ({maxTeams}) has already registered for this tournament.
                  </p>
                  <Link
                    href={`/tournament/${tournamentId}/teams`}
                    className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary font-medium mt-2 hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">groups</span>
                    View Registered Teams
                  </Link>
                </div>
              </div>
            )}

            {!isFull && isClosed && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-rose-400 text-lg shrink-0">lock</span>
                <p className="text-xs font-medium text-text-primary">
                  Signups are currently closed for this tournament.
                </p>
              </div>
            )}

            <form onSubmit={handleSignup}>
              <fieldset disabled={isFull || isClosed || submitting} className="space-y-4 disabled:opacity-50">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Team or Player Name</label>
                  <input 
                    autoFocus={!isFull && !isClosed}
                    required
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40 disabled:cursor-not-allowed"
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
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40 disabled:cursor-not-allowed"
                    placeholder="manager@team.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>

                {/* Dynamic Fields */}
                {(tournament.signup_schema || []).map((field: any) => (
                  <div key={field.id}>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                      {field.label} {field.required && <span className="text-text-primary">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <SelectField
                        required={field.required}
                        disabled={isFull || isClosed || submitting}
                        value={formResponses[field.id] || ""}
                        onChange={(val) => setFormResponses({ ...formResponses, [field.id]: val })}
                        options={field.options || []}
                        placeholder="Select an option"
                      />
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant">
                        <input 
                          type="checkbox"
                          required={field.required}
                          className="w-4 h-4 rounded bg-surface-container border-outline-variant text-text-primary focus:ring-0 disabled:cursor-not-allowed"
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
                        className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40 disabled:cursor-not-allowed"
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
                    disabled={submitting || isFull || isClosed}
                    className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-surface-container-lowest border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">how_to_reg</span>
                        Register for Tournament
                      </>
                    )}
                  </button>
                </div>
              </fieldset>

              {submitError && !isFull && (
                <div
                  role="alert"
                  className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs"
                >
                  <span className="material-symbols-outlined text-rose-400 text-base shrink-0 mt-0.5">error</span>
                  <p className="text-text-primary leading-relaxed">{submitError}</p>
                </div>
              )}
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default function TournamentSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
