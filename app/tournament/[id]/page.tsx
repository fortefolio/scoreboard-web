"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import GroupStandingsView from "@/components/GroupStandingsView";
import { DetailPageSkeleton } from "@/components/Skeleton";
import GroupMatchesView from "@/components/GroupMatchesView";
import TournamentBracket from "@/components/TournamentBracket";
import ConfirmationModal from "@/components/ConfirmationModal";
import NotificationBell from "@/components/NotificationBell";
import { SportFavoriteButton } from "@/components/FollowButton";
import MatchAtmosphereBackground from "@/components/match/MatchAtmosphereBackground";
import { useTranslation, getSportTranslation } from "@/lib/i18n";
import SelectField from "@/components/SelectField";
import { buildCsvTemplate, buildParticipantsCsv, parseTeamCsv } from "@/lib/csvTeams";

function TournamentContent() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<'standings' | 'group_matches' | 'bracket' | 'teams' | 'settings'>('teams');
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [draftTeamNames, setDraftTeamNames] = useState<Record<string, string>>({});
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamEmail, setNewTeamEmail] = useState("");
  const [newTeamFormResponses, setNewTeamFormResponses] = useState<Record<string, any>>({});
  const [isImportCsvModalOpen, setIsImportCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [rosterViewMode, setRosterViewMode] = useState<'grid' | 'list'>('grid');
  const [isRosterMenuOpen, setIsRosterMenuOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const rosterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRosterMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rosterMenuRef.current && !rosterMenuRef.current.contains(event.target as Node)) {
        setIsRosterMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsRosterMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRosterMenuOpen]);
  const [courts, setCourts] = useState<number>(1);
  const [maxTeams, setMaxTeams] = useState<number>(16);
  const [tStartDate, setTStartDate] = useState("");
  const [tEndDate, setTEndDate] = useState("");
  const [tVisibility, setTVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [signupFormConfig, setSignupFormConfig] = useState<any[]>([]);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const tournamentId = Array.isArray(id) ? id[0] : id;
  const isOrganizer = Boolean(
    user?.id && tournament?.organizer_id && user.id === tournament.organizer_id
  );

  const handleTabChange = (tab: typeof activeTab) => {
    if (tab === 'settings' && !isOrganizer) return;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/tournament/${tournamentId}?${params.toString()}`, { scroll: false });
  };

  // Sync activeTab with URL search params
  useEffect(() => {
    const tab = searchParams.get('tab') as any;
    if (tab && ['standings', 'group_matches', 'bracket', 'teams', 'settings'].includes(tab)) {
      if (tab === 'settings' && tournament && !isOrganizer) {
        setActiveTab('teams');
        return;
      }
      setActiveTab(tab);
    }
  }, [searchParams, tournament, isOrganizer]);

  useEffect(() => {
    if (tournamentId) {
      loadTournament();

      // Real-time listener for signups
      let channel: any = null;
      try {
        channel = supabase
          .channel(`tournament-participants-${tournamentId}`)
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'tournament_participants',
              filter: `tournament_id=eq.${tournamentId}`
            }, 
            () => {
              loadParticipants();
            }
          );

        channel.subscribe();
      } catch (err) {
        console.warn('[TournamentPage] Realtime unavailable:', err);
      }

      return () => {
        if (channel) {
          try { supabase.removeChannel(channel); } catch {}
        }
      };
    }
  }, [tournamentId]);

  const loadTournament = async () => {
    const { data } = await supabase
      .from("tournaments")
      .select("*, organizer:users!organizer_id(username)")
      .eq("id", tournamentId)
      .single();
    
    if (data) {
      setTournament(data);
      if (data.settings?.number_of_courts) {
        setCourts(data.settings.number_of_courts);
      }
      if (data.settings?.max_teams) {
        setMaxTeams(data.settings.max_teams);
      }
      if (data.start_date) setTStartDate(new Date(data.start_date).toISOString().split('T')[0]);
      if (data.end_date) setTEndDate(new Date(data.end_date).toISOString().split('T')[0]);
      if (data.visibility) setTVisibility(data.visibility);
      if (data.signup_schema) setSignupFormConfig(data.signup_schema);
      
      // Only set default tab if no tab is present in URL
      if (!searchParams.get('tab')) {
        if (data.status !== 'pending') {
          if (data.settings?.stage_1?.type === 'bracket' || data.settings?.stage_1?.type === 'double_elimination') {
            handleTabChange('bracket');
          } else {
            handleTabChange('standings');
          }
        }
      }
      loadParticipants(data.organizer_id);
    }
    setLoading(false);
  };

  const loadParticipants = async (organizerId?: string) => {
    const targetOrganizerId = organizerId ?? tournament?.organizer_id;
    let pData: any[] | null = null;

    if (user && targetOrganizerId && user.id === targetOrganizerId) {
      const { data: adminData, error: rpcError } = await supabase.rpc(
        "get_tournament_participants_admin",
        { p_tournament_id: tournamentId }
      );
      if (!rpcError && adminData) {
        pData = adminData;
      }
    }

    if (!pData) {
      const { data: publicData } = await supabase
        .from("tournament_participants")
        .select("id, name, seed, created_at")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: true });
      pData = publicData;
    }

    if (pData) {
      setParticipants(pData);
    }
  };

  const copySignupLink = () => {
    const url = `${window.location.origin}/tournament/${tournamentId}/signup`;
    navigator.clipboard.writeText(url);
    toast.success("Signup link copied to clipboard!");
  };

  const saveOverride = async (roundNum: number, sets: number, points: number, cap: number | null) => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      overrides: {
        ...(tournament.settings?.overrides || {}),
        [roundNum]: { max_sets: sets, points_per_set: points, point_cap: cap }
      }
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ settings: newSettings })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
      toast.success(`Rules updated for Round ${roundNum}`);
    } else {
      toast.error(`Error updating rules: ${error.message}`);
    }
  };

  const saveGeneralSettings = async () => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      number_of_courts: courts,
      max_teams: maxTeams
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ 
        settings: newSettings,
        start_date: tStartDate || null,
        end_date: tEndDate || null,
        visibility: tVisibility,
        signup_schema: signupFormConfig,
      })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings, start_date: tStartDate, end_date: tEndDate, visibility: tVisibility, signup_schema: signupFormConfig });
      toast.success("Tournament settings updated.");
    } else {
      toast.error(`Error updating settings: ${error.message}`);
    }
  };

  const saveRoundDate = async (key: string, date: string) => {
    if (!tournament) return;
    const newSettings = {
      ...tournament.settings,
      round_dates: {
        ...(tournament.settings?.round_dates || {}),
        [key]: date,
      },
    };

    const { error } = await supabase
      .from('tournaments')
      .update({ settings: newSettings })
      .eq('id', tournamentId);

    if (!error) {
      setTournament({ ...tournament, settings: newSettings });
      toast.success(`Date updated for ${key}`);
    } else {
      toast.error(`Error updating round date: ${error.message}`);
    }
  };

  const handleDeleteTournament = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      toast.success("Tournament deleted successfully.");
      router.push("/");
    } catch (err: any) {
      toast.error(`Error deleting tournament: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isManualParticipant = (p: any) =>
    !p.contact_email && (!p.custom_data || Object.keys(p.custom_data).length === 0);

  const handleTeamNameChange = (participantId: string, value: string) => {
    setDraftTeamNames((prev) => ({ ...prev, [participantId]: value }));
  };

  const saveTeamName = async (participant: any) => {
    const rawDraft = draftTeamNames[participant.id];
    if (rawDraft === undefined) return;

    const trimmed = rawDraft.trim();
    const clearDraft = () =>
      setDraftTeamNames((prev) => {
        const next = { ...prev };
        delete next[participant.id];
        return next;
      });

    if (!trimmed || trimmed === participant.name) {
      clearDraft();
      return;
    }

    const { error } = await supabase
      .from("tournament_participants")
      .update({ name: trimmed })
      .eq("id", participant.id);

    if (error) {
      toast.error(`Failed to update team name: ${error.message}`);
      return;
    }

    setParticipants((prev) =>
      prev.map((p) => (p.id === participant.id ? { ...p, name: trimmed } : p))
    );
    clearDraft();
  };

  const buildInitialSignupResponses = (schema: any[] = []) => {
    const initial: Record<string, any> = {};
    schema.forEach((field: any) => {
      if (field.type === "checkbox") {
        initial[field.id] = false;
      }
    });
    return initial;
  };

  const addTeam = async () => {
    if (!tournamentId || isAddingTeam || participants.length >= maxTeams) return;

    const hasRequiredSignupFields = signupFormConfig.some((f: any) => f.required);
    if (hasRequiredSignupFields) {
      setNewTeamName("");
      setNewTeamEmail("");
      setNewTeamFormResponses(buildInitialSignupResponses(signupFormConfig));
      setIsAddTeamModalOpen(true);
      return;
    }

    setIsAddingTeam(true);
    const defaultName = `Team ${participants.length + 1}`;
    try {
      const { data, error } = await supabase
        .from("tournament_participants")
        .insert({
          tournament_id: tournamentId,
          name: defaultName,
        })
        .select("id, name, seed, created_at")
        .single();

      if (error) throw error;
      if (data) {
        setParticipants((prev) =>
          prev.some((p) => p.id === data.id) ? prev : [...prev, data]
        );
      }
    } catch (err: any) {
      toast.error(`Failed to add team: ${err.message}`);
    } finally {
      setIsAddingTeam(false);
    }
  };

  const handleAddTeamModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentId || isAddingTeam || !newTeamName.trim()) return;
    if (participants.length >= maxTeams) {
      toast.error("This tournament has reached its maximum number of teams.");
      return;
    }

    setIsAddingTeam(true);
    try {
      const trimmedEmail = newTeamEmail.trim() || null;
      const { data, error } = await supabase
        .from("tournament_participants")
        .insert({
          tournament_id: tournamentId,
          name: newTeamName.trim(),
          contact_email: trimmedEmail,
          form_responses: newTeamFormResponses,
        })
        .select("id, name, seed, created_at")
        .single();

      if (error) throw error;
      if (data) {
        const createdParticipant = {
          ...data,
          contact_email: trimmedEmail,
          form_responses: newTeamFormResponses,
        };
        setParticipants((prev) =>
          prev.some((p) => p.id === data.id) ? prev : [...prev, createdParticipant]
        );
      }
      toast.success("Team added to roster!");
      setIsAddTeamModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to add team: ${err.message}`);
    } finally {
      setIsAddingTeam(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csv = buildCsvTemplate(signupFormConfig);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const slug = (tournament?.name || "tournament")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.download = `${slug || "tournament"}-teams-template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportParticipantsCsv = () => {
    if (participants.length === 0) return;
    const csv = buildParticipantsCsv(participants, signupFormConfig);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const slug = (tournament?.name || "tournament")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.download = `${slug || "tournament"}-participants.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const handlePrintParticipants = () => {
    if (participants.length === 0) return;
    const printWindow = window.open("", "_blank", "width=960,height=720");
    if (!printWindow) {
      toast.error("Please allow popups to print the participant list.");
      return;
    }

    const title = escapeHtml(tournament?.name || "Tournament Participants");
    const extraHeaders = signupFormConfig
      .map((f: any) => `<th>${escapeHtml(String(f.label || f.id))}</th>`)
      .join("");

    const rowsHtml = participants
      .map((p, idx) => {
        const extraCells = signupFormConfig
          .map((f: any) => {
            const raw = p.form_responses?.[f.id];
            const display =
              raw === undefined || raw === null || raw === ""
                ? "—"
                : typeof raw === "boolean"
                ? raw
                  ? "Yes"
                  : "No"
                : String(raw);
            return `<td>${escapeHtml(display)}</td>`;
          })
          .join("");

        return `<tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(String(p.name || ""))}</td>
          <td>${escapeHtml(String(p.contact_email || "—"))}</td>
          ${extraCells}
        </tr>`;
      })
      .join("");

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title} — Participants</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 24px; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      p { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
      th { background: #f3f4f6; font-weight: 600; }
      tr:nth-child(even) td { background: #f9fafb; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p>Participants (${participants.length} / ${maxTeams})</p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Team / Player</th>
          <th>Contact Email</th>
          ${extraHeaders}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    e.target.value = "";
  };

  const csvPreview = csvText.trim()
    ? parseTeamCsv(csvText, signupFormConfig)
    : { validRows: [], errors: [] };

  const remainingTeamSlots = Math.max(0, maxTeams - participants.length);

  const handleImportCsvSubmit = async () => {
    if (!tournamentId || isImportingCsv || remainingTeamSlots === 0) return;
    if (csvPreview.validRows.length === 0) {
      toast.error("No valid teams found to import.");
      return;
    }

    const rowsToImport = csvPreview.validRows.slice(0, remainingTeamSlots);
    setIsImportingCsv(true);
    try {
      const payload = rowsToImport.map((row) => ({
        tournament_id: tournamentId,
        name: row.name,
        contact_email: row.contact_email,
        form_responses: row.form_responses,
      }));

      const { data, error } = await supabase
        .from("tournament_participants")
        .insert(payload)
        .select("id, name, seed, created_at");

      if (error) throw error;
      if (data) {
        const enriched = data.map((inserted: any, idx: number) => ({
          ...inserted,
          contact_email: rowsToImport[idx]?.contact_email ?? null,
          form_responses: rowsToImport[idx]?.form_responses ?? {},
        }));
        setParticipants((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...enriched.filter((p: any) => !existingIds.has(p.id))];
        });
      }

      toast.success(`Imported ${rowsToImport.length} team${rowsToImport.length === 1 ? "" : "s"}!`);
      setCsvText("");
      setIsImportCsvModalOpen(false);
    } catch (err: any) {
      toast.error(`CSV import failed: ${err.message}`);
    } finally {
      setIsImportingCsv(false);
    }
  };

  const removeTeam = async (participantId: string) => {
    const { error } = await supabase
      .from("tournament_participants")
      .delete()
      .eq("id", participantId);

    if (error) {
      toast.error(`Failed to remove team: ${error.message}`);
      return;
    }

    setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    setDraftTeamNames((prev) => {
      const next = { ...prev };
      delete next[participantId];
      return next;
    });
  };

  const addSignupField = () => {
    const newField = {
      id: crypto.randomUUID(),
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      min: null,
      max: null,
      description: "",
      options: []
    };
    setSignupFormConfig([...signupFormConfig, newField]);
  };

  const updateSignupField = (id: string, updates: any) => {
    setSignupFormConfig(signupFormConfig.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeSignupField = (id: string) => {
    setSignupFormConfig(signupFormConfig.filter(f => f.id !== id));
  };

  const addOptionToField = (fieldId: string) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        return { ...f, options: [...(f.options || []), ""] };
      }
      return f;
    }));
  };

  const updateOptionInField = (fieldId: string, optionIdx: number, value: string) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        const newOptions = [...(f.options || [])];
        newOptions[optionIdx] = value;
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const removeOptionFromField = (fieldId: string, optionIdx: number) => {
    setSignupFormConfig(signupFormConfig.map(f => {
      if (f.id === fieldId) {
        const newOptions = (f.options || []).filter((_: any, i: number) => i !== optionIdx);
        return { ...f, options: newOptions };
      }
      return f;
    }));
  };

  const handleGenerateBracket = async () => {
    if (!tournament) return;
    setIsGenerating(true);
    try {
      // Flush any unsaved inline team name edits before generating the bracket
      const dirtyUpdates = participants
        .filter((p) => {
          const draft = draftTeamNames[p.id];
          return draft !== undefined && draft.trim() !== "" && draft.trim() !== p.name;
        })
        .map((p) => ({ id: p.id, name: draftTeamNames[p.id].trim() }));

      for (const update of dirtyUpdates) {
        const { error: updateError } = await supabase
          .from("tournament_participants")
          .update({ name: update.name })
          .eq("id", update.id);
        if (updateError) throw updateError;
      }

      const resolvedTeams = participants
        .map((p) => (draftTeamNames[p.id] ?? p.name).trim())
        .filter((name) => name !== "");

      const { error } = await supabase.functions.invoke("generate-tournament-bracket", {
        body: {
          tournament_id: tournament.id,
          organizer_id: tournament.organizer_id,
          sport_type: tournament.sport_type,
          teams: resolvedTeams,
          settings: tournament.settings
        }
      });
      if (error) throw error;
      
      toast.success("Bracket generated successfully!");
      await loadTournament();
    } catch (err: any) {
      toast.error(`Error generating bracket: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!tournamentId) return null;

  if (loading) {
    return <DetailPageSkeleton />;
  }

  const handleShareTournament = async () => {
    const shareUrl = window.location.href;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: tournament?.name || "ScoreBoard Tournament",
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Tournament link copied!");
    } catch {
      // User cancelled native share or clipboard unavailable
    }
  };

  const formatDateRange = () => {
    if (!tournament?.start_date) return null;
    const fmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
    const start = new Date(tournament.start_date);
    if (!tournament?.end_date || tournament.end_date === tournament.start_date) {
      return fmt.format(start);
    }
    const end = new Date(tournament.end_date);
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  };

  const dateRangeLabel = formatDateRange();
  const organizerUsername = tournament?.organizer?.username || null;

  return (
    <div className="min-h-screen bg-transparent text-on-background font-sans selection:bg-text-primary selection:text-surface-container-lowest relative">
      <MatchAtmosphereBackground sportType={tournament?.sport_type} mode="spectator" />
      <main className="pt-3 sm:pt-6 pb-20 px-4 sm:px-6 md:px-8 max-w-7xl mx-auto relative z-10">
        <header className="bg-surface-container rounded-2xl p-3.5 sm:p-4 border border-outline-variant shadow-sm mb-4 sm:mb-5">
          <div className="grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2.5 mb-2.5">
            <div className="col-start-1 row-start-1 flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => router.back()}
                aria-label="Back"
                title="Back"
                className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              {organizerUsername && (
                <Link
                  href={`/user/${organizerUsername}`}
                  className="h-7 px-2.5 rounded-md text-xs font-medium border border-outline-variant bg-surface-container-high text-text-secondary hover:text-text-primary hover:bg-surface-container-highest inline-flex items-center transition-colors truncate"
                >
                  <span className="truncate">@{organizerUsername}</span>
                </Link>
              )}
            </div>

            <div className="col-start-2 md:col-start-3 row-start-1 justify-self-end flex items-center gap-2 shrink-0">
              <SportFavoriteButton
                entityId={tournamentId}
                entityType="tournament"
                sport={tournament?.sport_type}
                size="sm"
              />
              <button
                type="button"
                onClick={handleShareTournament}
                aria-label="Share tournament"
                title="Share tournament"
                className="w-8 h-8 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
            </div>

            <h1 className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1 font-sans text-xl sm:text-2xl font-semibold tracking-tight text-text-primary leading-tight text-center">
              {tournament?.name || "Tournament"}
            </h1>
          </div>

          <div className="flex items-center justify-center flex-wrap gap-x-2.5 gap-y-1.5 text-xs text-text-muted">
            <span className="h-6 px-2 rounded-md text-[11px] font-medium border border-outline-variant bg-surface-container-high text-text-secondary inline-flex items-center gap-1.5 capitalize">
              {tournament?.status === "ongoing" && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              )}
              {tournament?.status}
            </span>
            {dateRangeLabel && (
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                {dateRangeLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">groups</span>
              {participants.length} / {maxTeams}
            </span>
          </div>
        </header>

        {/* Precision Telemetry Segmented Tab Bar */}
        <div className="mb-5 sm:mb-6 overflow-x-auto no-scrollbar max-w-full pb-1">
          <div className="bg-surface-container-low p-1 rounded-xl border border-outline-variant flex gap-1 w-max mx-auto">
            <button 
              onClick={() => handleTabChange('teams')}
              className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                activeTab === 'teams'
                  ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] leading-none">groups</span>
              {t("tournament.teamsTab")}
            </button>
            {tournament?.settings?.stage_1?.type === 'groups' && tournament?.status !== 'pending' && (
              <>
                <button 
                  onClick={() => handleTabChange('standings')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'standings'
                      ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">bar_chart</span>
                  {t("tournament.standingsTab")}
                </button>
                <button 
                  onClick={() => handleTabChange('group_matches')}
                  className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                    activeTab === 'group_matches'
                      ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">sports_tennis</span>
                  {t("tournament.matchesTab")}
                </button>
              </>
            )}
            {tournament?.status !== 'pending' && (
              <button 
                onClick={() => handleTabChange('bracket')}
                className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'bracket'
                    ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">account_tree</span>
                Bracket
              </button>
            )}
            {isOrganizer && (
              <button 
                onClick={() => handleTabChange('settings')}
                className={`px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'settings'
                    ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-container-high/40'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">settings</span>
                {t("tournament.settingsTab")}
              </button>
            )}
          </div>
        </div>

        {/* View Content */}
        <div className="animate-in fade-in duration-300">
          {activeTab === 'teams' ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant relative">
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8 pb-5 border-b border-outline-variant">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-1">Tournament Roster</h2>
                      <p className="text-text-muted text-xs sm:text-sm">Manage participating teams and players ({participants.length} / {maxTeams}).</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {isOrganizer && (
                        <button 
                          onClick={addTeam}
                          disabled={isAddingTeam || participants.length >= maxTeams}
                          className="flex-1 sm:flex-initial justify-center h-9 bg-text-primary hover:bg-white text-surface-container-lowest px-3.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px] leading-none">add</span>
                          {participants.length >= maxTeams ? 'Limit Reached' : 'Add Team'}
                        </button>
                      )}

                      {/* Grid / List View Toggle */}
                      <div className="h-9 flex items-center bg-surface-container-high p-1 rounded-lg border border-outline-variant shrink-0">
                        <button
                          type="button"
                          onClick={() => setRosterViewMode('grid')}
                          title="Grid view"
                          aria-label="Grid view"
                          className={`h-full w-7 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                            rosterViewMode === 'grid'
                              ? 'bg-surface-container-highest text-text-primary shadow-sm'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px] leading-none">grid_view</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRosterViewMode('list')}
                          title="List view"
                          aria-label="List view"
                          className={`h-full w-7 rounded-md transition-colors flex items-center justify-center cursor-pointer ${
                            rosterViewMode === 'list'
                              ? 'bg-surface-container-highest text-text-primary shadow-sm'
                              : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[17px] leading-none">format_list_bulleted</span>
                        </button>
                      </div>

                      {/* Three-dot Actions Menu (Organizer only) */}
                      {isOrganizer && (
                      <div className="relative shrink-0" ref={rosterMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsRosterMenuOpen((prev) => !prev)}
                          title="Roster Actions"
                          aria-label="Roster Actions"
                          aria-expanded={isRosterMenuOpen}
                          className="h-9 w-9 rounded-lg bg-surface-container-high text-text-secondary hover:text-text-primary hover:bg-surface-container-highest border border-outline-variant flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px] leading-none">more_vert</span>
                        </button>

                        {isRosterMenuOpen && (
                          <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl py-1.5 z-50 animate-in fade-in duration-150">
                            <button
                              type="button"
                              onClick={() => {
                                setIsRosterMenuOpen(false);
                                copySignupLink();
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-container-highest flex items-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[16px] text-text-muted">share</span>
                              Share Signup Link
                            </button>

                            {tournament.status === 'pending' && (
                              <button
                                type="button"
                                disabled={participants.length >= maxTeams}
                                onClick={() => {
                                  setIsRosterMenuOpen(false);
                                  setCsvText("");
                                  setIsImportCsvModalOpen(true);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-container-highest flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[16px] text-text-muted">upload_file</span>
                                Import CSV
                              </button>
                            )}

                            {participants.length > 0 && (
                              <>
                                <div className="my-1 border-t border-outline-variant" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsRosterMenuOpen(false);
                                    handleExportParticipantsCsv();
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-container-highest flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-text-muted">download</span>
                                  Export CSV
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsRosterMenuOpen(false);
                                    handlePrintParticipants();
                                  }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-text-primary hover:bg-surface-container-highest flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-text-muted">print</span>
                                  Print
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  </div>

                  {participants.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-outline-variant rounded-xl bg-surface-container-low">
                      <span className="material-symbols-outlined text-3xl text-text-muted opacity-40 mb-2">groups</span>
                      <p className="text-sm font-medium text-text-primary">No teams registered yet</p>
                      <p className="text-xs text-text-muted mt-1">Click Add Team or share the signup link to start building your roster.</p>
                    </div>
                  ) : rosterViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {participants.map((p, idx) => (
                        isOrganizer && tournament.status === 'pending' && isManualParticipant(p) ? (
                          <div key={p.id} className="relative group flex items-center gap-2">
                            <div className="relative flex-1 min-w-0">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-text-muted">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <input
                                className="w-full pl-11 pr-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
                                placeholder={`Assign Team ${idx + 1}`}
                                value={draftTeamNames[p.id] ?? p.name}
                                onChange={(e) => handleTeamNameChange(p.id, e.target.value)}
                                onBlur={() => saveTeamName(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                              />
                            </div>
                            <button
                              onClick={() => removeTeam(p.id)}
                              className="w-10 h-10 rounded-xl bg-surface-container-high text-text-muted hover:text-error hover:bg-error/10 transition-colors flex items-center justify-center border border-outline-variant shrink-0 cursor-pointer"
                              title="Remove Team"
                            >
                              <span className="material-symbols-outlined text-sm leading-none">delete</span>
                            </button>
                          </div>
                        ) : (
                          <div key={p.id} className="relative group flex items-center gap-2">
                            <div className="relative flex-1 min-w-0">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-text-muted">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="w-full pl-11 pr-4 py-3 bg-surface-container-high rounded-xl border border-outline-variant text-text-primary font-medium text-sm flex items-center justify-between gap-2">
                                <span className="truncate">{p.name}</span>
                                <span className="text-xs text-text-muted font-normal truncate max-w-[140px]">{p.contact_email}</span>
                              </div>
                            </div>
                            {isOrganizer && (
                              <button 
                                onClick={() => setSelectedParticipant(p)}
                                className="w-10 h-10 rounded-xl bg-surface-container-high text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-outline-variant shrink-0 cursor-pointer"
                                title="View Participant Details"
                              >
                                <span className="material-symbols-outlined text-sm leading-none">visibility</span>
                              </button>
                            )}
                            {isOrganizer && tournament.status === 'pending' && (
                              <button
                                onClick={() => removeTeam(p.id)}
                                className="w-10 h-10 rounded-xl bg-surface-container-high text-text-muted hover:text-error hover:bg-error/10 transition-colors flex items-center justify-center border border-outline-variant shrink-0 cursor-pointer"
                                title="Remove Team"
                              >
                                <span className="material-symbols-outlined text-sm leading-none">delete</span>
                              </button>
                            )}
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-outline-variant overflow-hidden divide-y divide-outline-variant bg-surface-container-low">
                      {participants.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/50 transition-colors">
                          <span className="text-xs font-mono font-medium text-text-muted w-6 shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4">
                            {isOrganizer && tournament.status === 'pending' && isManualParticipant(p) ? (
                              <input
                                className="w-full sm:max-w-xs px-2.5 py-1.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
                                placeholder={`Assign Team ${idx + 1}`}
                                value={draftTeamNames[p.id] ?? p.name}
                                onChange={(e) => handleTeamNameChange(p.id, e.target.value)}
                                onBlur={() => saveTeamName(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                              />
                            ) : (
                              <span className="text-sm font-medium text-text-primary truncate">{p.name}</span>
                            )}
                            {p.contact_email && (
                              <span className="text-xs text-text-muted truncate">{p.contact_email}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isOrganizer && !(tournament.status === 'pending' && isManualParticipant(p)) && (
                              <button
                                onClick={() => setSelectedParticipant(p)}
                                className="w-8 h-8 rounded-lg bg-surface-container-high text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors flex items-center justify-center border border-outline-variant cursor-pointer"
                                title="View Participant Details"
                              >
                                <span className="material-symbols-outlined text-[16px] leading-none">visibility</span>
                              </button>
                            )}
                            {isOrganizer && tournament.status === 'pending' && (
                              <button
                                onClick={() => removeTeam(p.id)}
                                className="w-8 h-8 rounded-lg bg-surface-container-high text-text-muted hover:text-error hover:bg-error/10 transition-colors flex items-center justify-center border border-outline-variant cursor-pointer"
                                title="Remove Team"
                              >
                                <span className="material-symbols-outlined text-[16px] leading-none">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'standings' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="max-w-6xl mx-auto">
               <GroupStandingsView tournamentId={tournamentId} />
            </div>
          ) : activeTab === 'group_matches' && tournament?.settings?.stage_1?.type === 'groups' ? (
            <div className="max-w-6xl mx-auto">
               <GroupMatchesView tournamentId={tournamentId} tournament={tournament} onSaveOverride={saveOverride} onSaveScheduledDate={saveRoundDate} />
            </div>
          ) : activeTab === 'bracket' ? (
            <TournamentBracket tournamentId={tournamentId} tournamentFromParent={tournament} onSaveOverrideFromParent={saveOverride} onSaveScheduledDate={saveRoundDate} />
          ) : activeTab === 'settings' && isOrganizer ? (
            <div className="w-full max-w-4xl mx-auto space-y-6">
              <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-6">Tournament Settings</h2>
                <div className="space-y-6">
                  <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-outline-variant">
                    <h3 className="text-sm font-semibold text-text-primary mb-5">General Configuration</h3>
                    <div className="space-y-5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament Start Date</label>
                          <input 
                            type="date"
                            className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-outline-focus transition-colors"
                            value={tStartDate}
                            onChange={(e) => setTStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament End Date</label>
                          <input 
                            type="date"
                            className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-outline-focus transition-colors"
                            value={tEndDate}
                            onChange={(e) => setTEndDate(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Number of Available Courts</label>
                        <div className="flex items-center gap-4">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-outline-focus transition-colors"
                            value={courts}
                            onChange={(e) => setCourts(parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Tournament Visibility</label>
                        <div className="flex bg-surface-container-high p-1 rounded-lg border border-outline-variant gap-1">
                          {(['public', 'unlisted', 'private'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setTVisibility(mode)}
                              className={`flex-1 py-2 rounded-md text-xs font-medium uppercase tracking-wider transition-colors ${
                                tVisibility === mode
                                  ? 'bg-surface-container text-text-primary border border-outline-variant shadow-sm'
                                  : 'text-text-muted hover:text-text-primary'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs text-text-muted">
                          {tVisibility === 'public'
                            ? 'Visible to everyone on the landing page'
                            : tVisibility === 'unlisted'
                            ? 'Hidden from landing page; accessible via direct link'
                            : 'Only visible to you (organizer)'}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-text-secondary block mb-1.5">Maximum Number of Teams</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            min="1"
                            className="flex-1 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant font-medium text-xs text-text-primary outline-none focus:border-outline-focus transition-colors"
                            value={maxTeams}
                            onChange={(e) => setMaxTeams(parseInt(e.target.value) || 1)}
                          />
                          <button 
                            onClick={saveGeneralSettings}
                            className="bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2.5 rounded-lg font-medium text-xs transition-colors shrink-0 cursor-pointer"
                          >
                            Save Settings
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 rounded-xl bg-surface-container-low border border-outline-variant relative">
                    <div>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isFormBuilderOpen}
                        onClick={() => setIsFormBuilderOpen((prev) => !prev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIsFormBuilderOpen((prev) => !prev);
                          }
                        }}
                        className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none ${
                          isFormBuilderOpen ? 'mb-6 pb-5 border-b border-outline-variant' : ''
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2.5 mb-1">
                            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">Signup Form Builder</h2>
                            <span className="px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant text-[11px] font-medium text-text-secondary">
                              {signupFormConfig.length} {signupFormConfig.length === 1 ? 'field' : 'fields'}
                            </span>
                          </div>
                          <p className="text-text-muted text-xs sm:text-sm max-w-xl leading-relaxed">
                            Configure registration fields, required responses, and options for participants.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-end md:self-center">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsFormBuilderOpen(true);
                              addSignupField();
                            }}
                            className="h-9 bg-surface-container-high hover:bg-surface-container-highest text-text-primary px-3.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 border border-outline-variant active:scale-95 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none text-text-muted">add</span>
                            Add Field
                          </button>
                          <span
                            className="w-9 h-9 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-text-muted"
                            aria-hidden="true"
                          >
                            <span className="material-symbols-outlined text-[18px] leading-none">
                              {isFormBuilderOpen ? 'expand_less' : 'expand_more'}
                            </span>
                          </span>
                        </div>
                      </div>

                      {isFormBuilderOpen && (
                        <>
                          <div className="space-y-4">
                        {signupFormConfig.map((field) => (
                          <div key={field.id} className="p-5 bg-surface-container rounded-xl border border-outline-variant group/field">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-text-muted border border-outline-variant">
                                  <span className="material-symbols-outlined text-sm">
                                    {field.type === 'text' ? 'text_fields' :
                                     field.type === 'number' ? '123' :
                                     field.type === 'select' ? 'list' :
                                     'check_box'}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="font-medium text-text-primary text-sm leading-none mb-1">{field.label || "Untitled Field"}</h4>
                                  <span className="text-[11px] text-text-muted">
                                    {field.type === 'text' ? 'Text Input Field' :
                                     field.type === 'number' ? 'Numeric Input Field' :
                                     field.type === 'select' ? 'Dropdown Select Field' :
                                     'Checkbox / Toggle Field'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-text-muted">Required</span>
                                  <button 
                                    type="button"
                                    onClick={() => updateSignupField(field.id, { required: !field.required })}
                                    className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${field.required ? 'bg-text-primary' : 'bg-surface-container-highest border border-outline-variant'}`}
                                  >
                                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${field.required ? 'left-4 bg-surface-container-lowest' : 'left-0.5 bg-text-muted'}`}></div>
                                  </button>
                                </div>
                                <button 
                                  onClick={() => removeSignupField(field.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                                  title="Remove Field"
                                >
                                  <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
                              <div className="lg:col-span-4">
                                <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Field Label</label>
                                <input 
                                  className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant"
                                  placeholder="e.g. T-Shirt Size"
                                  value={field.label}
                                  onChange={(e) => updateSignupField(field.id, { label: e.target.value })}
                                />
                              </div>

                              <div className="lg:col-span-2">
                                <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Field Type</label>
                                <select
                                  className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant"
                                  value={field.type}
                                  onChange={(e) => updateSignupField(field.id, { type: e.target.value })}
                                >
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                  <option value="select">Select</option>
                                  <option value="checkbox">Checkbox</option>
                                </select>
                              </div>

                              {field.type === 'text' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Placeholder Text</label>
                                  <input 
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant"
                                    placeholder="Enter placeholder..."
                                    value={field.placeholder || ""}
                                    onChange={(e) => updateSignupField(field.id, { placeholder: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'number' && (
                                <>
                                  <div className="lg:col-span-3">
                                    <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Min</label>
                                    <input 
                                      type="number"
                                      className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant"
                                      value={field.min || ""}
                                      onChange={(e) => updateSignupField(field.id, { min: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                  <div className="lg:col-span-3">
                                    <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Max</label>
                                    <input 
                                      type="number"
                                      className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant"
                                      value={field.max || ""}
                                      onChange={(e) => updateSignupField(field.id, { max: parseInt(e.target.value) || null })}
                                    />
                                  </div>
                                </>
                              )}

                              {field.type === 'checkbox' && (
                                <div className="lg:col-span-6">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Description / Subtext</label>
                                  <textarea 
                                    className="w-full px-3 py-2 bg-surface-container-high rounded-lg text-text-primary font-medium text-xs outline-none focus:border-outline-focus transition-colors border border-outline-variant min-h-[64px] resize-none"
                                    placeholder="Check this box if your team will be attending..."
                                    value={field.description || ""}
                                    onChange={(e) => updateSignupField(field.id, { description: e.target.value })}
                                  />
                                </div>
                              )}

                              {field.type === 'select' && (
                                <div className="lg:col-span-12">
                                  <label className="text-[11px] font-medium text-text-muted mb-1.5 block">Options</label>
                                  <div className="flex flex-wrap gap-2 p-3 bg-surface-container-high rounded-lg border border-outline-variant">
                                    {(field.options || []).map((opt: string, optIdx: number) => (
                                      <div key={optIdx} className="bg-surface-container px-3 py-1.5 rounded-md flex items-center gap-2 border border-outline-variant text-xs">
                                        <input 
                                          className="bg-transparent text-xs font-medium text-text-primary outline-none min-w-[70px]"
                                          value={opt}
                                          onChange={(e) => updateOptionInField(field.id, optIdx, e.target.value)}
                                        />
                                        <button 
                                          onClick={() => removeOptionFromField(field.id, optIdx)}
                                          className="text-text-muted hover:text-error transition-colors"
                                        >
                                          <span className="material-symbols-outlined text-sm leading-none">close</span>
                                        </button>
                                      </div>
                                    ))}
                                    <button 
                                      onClick={() => addOptionToField(field.id)}
                                      className="group flex items-center gap-1.5 px-3 py-1.5 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-sm leading-none">add_circle</span>
                                      <span className="group-hover:underline">Add Option</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {signupFormConfig.length === 0 && (
                          <div className="py-12 text-center bg-surface-container rounded-xl border border-dashed border-outline-variant group/empty">
                            <span className="material-symbols-outlined text-3xl text-text-muted/40 mb-2 block">dynamic_form</span>
                            <p className="text-text-muted text-xs font-medium">No custom fields defined</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-8 pt-5 border-t border-outline-variant flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                           <h3 className="text-sm font-semibold text-text-primary">Configuration Complete?</h3>
                           <p className="text-text-muted text-xs">Save your changes to update the live registration portal.</p>
                        </div>
                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                           <button 
                             onClick={() => setIsPreviewModalOpen(true)}
                             className="flex-1 sm:flex-none px-4 py-2 bg-transparent border border-outline-variant rounded-lg text-text-primary font-medium text-xs hover:bg-surface-container-high transition-colors cursor-pointer"
                           >
                             Preview Form
                           </button>
                           <button 
                             onClick={saveGeneralSettings}
                             className="flex-1 sm:flex-none bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg font-medium text-xs transition-colors cursor-pointer"
                           >
                             Save Form Config
                           </button>
                        </div>
                      </div>
                        </>
                      )}
                    </div>
                  </div>

                  {tournament?.status === 'pending' && (
                    <div className="p-5 sm:p-6 rounded-xl bg-surface-container-low border border-outline-variant">
                      <h3 className="text-sm font-semibold text-text-primary mb-1">Tournament Generation</h3>
                      <p className="text-text-muted text-xs mb-4 leading-relaxed">
                        Ready to start? Generating the bracket will finalize the current roster and create all initial matches.
                      </p>
                      <button 
                        onClick={handleGenerateBracket}
                        disabled={isGenerating}
                        className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm leading-none">bolt</span>
                        {isGenerating ? "Generating..." : "Generate Tournament Bracket"}
                      </button>
                    </div>
                  )}

                  <div className="p-5 sm:p-6 rounded-xl bg-error/5 border border-error/20">
                    <h3 className="text-sm font-semibold text-error mb-1">Danger Zone</h3>
                    <p className="text-text-muted text-xs mb-4 leading-relaxed">
                      Deleting a tournament is a permanent action. All matches, team rosters, and historical scores will be erased permanently.
                    </p>
                    <button 
                      onClick={() => setIsDeleteModalOpen(true)}
                      disabled={isDeleting}
                      className="w-full bg-error hover:bg-error/90 text-white py-2.5 px-4 rounded-lg font-medium text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">delete_forever</span>
                      {isDeleting ? "Deleting..." : "Permanently Delete Tournament"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      <ConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTournament}
        title="Delete Tournament?"
        message="Are you sure you want to delete this tournament? This will permanently remove all matches, participants, and scoring data. This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete Permanently"}
        isDanger={true}
      />

      {/* ADD TEAM MODAL (when signup form has required fields) */}
      {isAddTeamModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">Add Team</h3>
                <p className="text-text-muted text-xs mt-0.5">Complete required registration fields to add a team</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTeamModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>

            <form onSubmit={handleAddTeamModalSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Team or Player Name <span className="text-text-primary">*</span>
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
                  placeholder="e.g. Lisbon Master"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
                  placeholder="manager@team.com (optional)"
                  value={newTeamEmail}
                  onChange={(e) => setNewTeamEmail(e.target.value)}
                />
              </div>

              {signupFormConfig.map((field: any) => (
                <div key={field.id}>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">
                    {field.label || field.id} {field.required && <span className="text-text-primary">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <SelectField
                      required={field.required}
                      disabled={isAddingTeam}
                      value={newTeamFormResponses[field.id] || ""}
                      onChange={(val) =>
                        setNewTeamFormResponses((prev) => ({ ...prev, [field.id]: val }))
                      }
                      options={field.options || []}
                      placeholder="Select an option"
                    />
                  ) : field.type === "checkbox" ? (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant">
                      <input
                        type="checkbox"
                        required={field.required}
                        className="w-4 h-4 rounded bg-surface-container border-outline-variant text-text-primary focus:ring-0"
                        checked={Boolean(newTeamFormResponses[field.id])}
                        onChange={(e) =>
                          setNewTeamFormResponses((prev) => ({ ...prev, [field.id]: e.target.checked }))
                        }
                      />
                      <span className="text-text-secondary text-xs font-medium">
                        {field.description || `Agree to ${field.label || field.id}`}
                      </span>
                    </div>
                  ) : (
                    <input
                      required={field.required}
                      type={field.type || "text"}
                      min={field.type === "number" && field.min != null ? field.min : undefined}
                      max={field.type === "number" && field.max != null ? field.max : undefined}
                      className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-sm outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
                      placeholder={field.placeholder || `Enter ${(field.label || field.id).toLowerCase()}`}
                      value={newTeamFormResponses[field.id] || ""}
                      onChange={(e) =>
                        setNewTeamFormResponses((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddTeamModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingTeam || !newTeamName.trim()}
                  className="bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isAddingTeam ? "Adding..." : "Add Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT CSV MODAL */}
      {isImportCsvModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">Import Teams from CSV</h3>
                <p className="text-text-muted text-xs mt-0.5">
                  Add up to {remainingTeamSlots} more team{remainingTeamSlots === 1 ? "" : "s"} ({participants.length} / {maxTeams} filled)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportCsvModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-text-muted leading-relaxed">
                  <p className="font-medium text-text-primary mb-0.5">Expected CSV columns</p>
                  <p className="font-mono text-[11px] break-all">
                    name*, email{signupFormConfig.map((f: any) => `, ${f.label || f.id}${f.required ? "*" : ""}`).join("")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-primary text-xs font-medium shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Template
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="px-3.5 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-primary text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                  <span className="material-symbols-outlined text-sm text-text-muted">upload_file</span>
                  Choose .csv file
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-text-muted">or paste CSV rows below</span>
              </div>

              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`name,email${signupFormConfig.map((f: any) => `,${f.label || f.id}`).join("")}\nPorto FC,porto@example.com${signupFormConfig.map((f: any) => `,${f.options?.[0] || "value"}`).join("")}`}
                className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-mono text-xs outline-none focus:border-outline-focus transition-colors placeholder:text-text-muted/40"
              />

              {csvText.trim() && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">
                      Valid teams: <span className="text-text-primary">{csvPreview.validRows.length}</span>
                    </span>
                    {csvPreview.validRows.length > remainingTeamSlots && (
                      <span className="text-amber-400">
                        Only the first {remainingTeamSlots} will be imported (max {maxTeams})
                      </span>
                    )}
                  </div>

                  {csvPreview.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-error/10 border border-error/25 space-y-1 max-h-28 overflow-y-auto">
                      {csvPreview.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-error">
                          Row {err.rowNumber}: {err.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportCsvModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-container-high transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportCsvSubmit}
                  disabled={isImportingCsv || csvPreview.validRows.length === 0 || remainingTeamSlots === 0}
                  className="bg-text-primary hover:bg-white text-surface-container-lowest px-4 py-2 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isImportingCsv
                    ? "Importing..."
                    : `Import ${Math.min(csvPreview.validRows.length, remainingTeamSlots)} Team${
                        Math.min(csvPreview.validRows.length, remainingTeamSlots) === 1 ? "" : "s"
                      }`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPANT DETAILS MODAL */}
      {selectedParticipant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">{selectedParticipant.name}</h3>
                <p className="text-text-muted text-xs mt-0.5">{selectedParticipant.contact_email || "No contact email visible"}</p>
              </div>
              <button
                onClick={() => setSelectedParticipant(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>
            <div className="p-6 overflow-y-auto space-y-3">
              {signupFormConfig.length > 0 ? (
                signupFormConfig.map((field: any) => (
                  <div key={field.id} className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant">
                    <p className="text-[11px] font-medium text-text-muted mb-0.5">{field.label || field.id}</p>
                    <p className="font-medium text-text-primary text-xs">
                      {String(selectedParticipant.form_responses?.[field.id] ?? "—")}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-text-muted text-xs italic text-center py-6">No custom signup fields configured for this tournament.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORM PREVIEW MODAL */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant relative z-10 overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-6 py-4 flex justify-between items-center bg-surface-container-high border-b border-outline-variant">
              <div>
                <h3 className="text-base font-semibold text-text-primary leading-tight">Live Form Preview</h3>
                <p className="text-text-muted text-xs mt-0.5">This is how participants will see your registration form</p>
              </div>
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Core Fields (Static) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">Team or Player Name <span className="text-text-primary">*</span></label>
                  <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs opacity-70">
                    Lisbon Masters
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">Contact Email <span className="text-text-primary">*</span></label>
                  <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs opacity-70">
                    manager@team.com
                  </div>
                </div>
              </div>

              {/* Dynamic Fields */}
              <div className="pt-4 border-t border-outline-variant space-y-4">
                {signupFormConfig.map((field) => (
                  <div key={field.id}>
                    <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                      {field.label || "Untitled Field"} {field.required && <span className="text-text-primary">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-muted font-medium text-xs flex justify-between items-center">
                        <span>Select an option</span>
                        <span className="material-symbols-outlined text-sm leading-none">expand_more</span>
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant">
                        <div className="w-4 h-4 rounded bg-surface-container border border-outline-variant"></div>
                        <span className="text-text-secondary text-xs font-medium">I agree to {field.label || "this condition"}</span>
                      </div>
                    ) : (
                      <div className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-muted font-medium text-xs">
                        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                      </div>
                    )}
                    {field.description && (
                       <p className="mt-1 text-text-muted text-[11px] leading-relaxed">{field.description}</p>
                    )}
                  </div>
                ))}

                {signupFormConfig.length === 0 && (
                  <p className="text-center text-text-muted text-xs italic py-6">No custom fields added yet.</p>
                )}
              </div>
            </div>

            <footer className="p-4 bg-surface-container-high border-t border-outline-variant">
              <button 
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-full bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 rounded-lg font-medium text-xs transition-colors cursor-pointer"
              >
                Back to Editor
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TournamentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-text-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-on-surface-variant font-label tracking-widest uppercase text-xs">Loading Tournament Details...</p>
      </div>
    }>
      <TournamentContent />
    </Suspense>
  );
}
