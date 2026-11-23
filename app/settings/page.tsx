"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Locale } from "@/lib/i18n/types";
import { isValidStripeRedirectUrl } from "@/lib/stripe/validateRedirect";
import SelectField from "@/components/SelectField";
import { SUPPORTED_SPORTS } from "@/lib/sports";
import { toast } from "sonner";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import { validatePassword } from "@/lib/auth/passwordValidation";
import { DetailPageSkeleton } from "@/components/Skeleton";

type TabType = "profile" | "preferences" | "notifications" | "security" | "danger";

function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  testId,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
        checked
          ? "bg-text-primary border-text-primary"
          : "bg-surface-container border-outline-variant"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full transition-transform ${
          checked
            ? "translate-x-5 bg-surface-container-lowest"
            : "translate-x-1 bg-text-muted"
        }`}
      />
    </button>
  );
}

interface NotificationPreferences {
  enabled?: boolean;
  umpire_invited?: boolean;
  match_started?: boolean;
  match_ended?: boolean;
  tennis_padel_enabled?: boolean;
  tennis_padel_sets?: boolean;
  tennis_padel_games?: boolean;
  volleyball_enabled?: boolean;
  volleyball_sets?: boolean;
  volleyball_points?: boolean;
  football_enabled?: boolean;
  football_goals?: boolean;
  football_cards?: boolean;
  basketball_enabled?: boolean;
  basketball_points?: boolean;
  basketball_quarters?: boolean;
  // Legacy keys (read fallback)
  tennis_padel_granularity?: "none" | "set" | "game";
  volleyball_granularity?: "none" | "set" | "point";
}

interface UserPreferences {
  language?: Locale;
  default_sport?: string | null;
  haptics_enabled?: boolean;
  sound_enabled?: boolean;
  notifications?: NotificationPreferences;
}

export default function SettingsPage() {
  const { user, supabase, signOut } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("profile");
  const [loading, setLoading] = useState(true);

  // Profile Tab State
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState<string>("free");
  const [subDetails, setSubDetails] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences Tab State
  const [selectedLanguage, setSelectedLanguage] = useState<Locale>(locale);
  const [defaultSport, setDefaultSport] = useState<string>("all");
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notifAllEnabled, setNotifAllEnabled] = useState<boolean>(true);
  const [notifUmpireInvited, setNotifUmpireInvited] = useState<boolean>(true);
  const [notifMatchStarted, setNotifMatchStarted] = useState<boolean>(true);
  const [notifMatchEnded, setNotifMatchEnded] = useState<boolean>(true);
  const [notifTennisEnabled, setNotifTennisEnabled] = useState<boolean>(true);
  const [notifTennisSets, setNotifTennisSets] = useState<boolean>(true);
  const [notifTennisGames, setNotifTennisGames] = useState<boolean>(false);
  const [notifVolleyEnabled, setNotifVolleyEnabled] = useState<boolean>(true);
  const [notifVolleySets, setNotifVolleySets] = useState<boolean>(true);
  const [notifVolleyPoints, setNotifVolleyPoints] = useState<boolean>(false);
  const [notifFootballEnabled, setNotifFootballEnabled] = useState<boolean>(true);
  const [notifFootballGoals, setNotifFootballGoals] = useState<boolean>(true);
  const [notifFootballCards, setNotifFootballCards] = useState<boolean>(true);
  const [notifBasketballEnabled, setNotifBasketballEnabled] = useState<boolean>(true);
  const [notifBasketballPoints, setNotifBasketballPoints] = useState<boolean>(true);
  const [notifBasketballQuarters, setNotifBasketballQuarters] = useState<boolean>(true);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Security Tab State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [exportingData, setExportingData] = useState(false);

  // Danger Zone Tab State
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("username, display_name, subscription_tier, preferences")
          .eq("id", user.id)
          .maybeSingle();

        if (!error && data) {
          const userHandle = data.username || "";
          const userDisplay = data.display_name || userHandle;
          setUsername(userHandle);
          setInitialUsername(userHandle);
          setDisplayName(userDisplay);
          setInitialDisplayName(userDisplay);
          setSubscriptionTier(data.subscription_tier || "free");

          const prefs = (data.preferences || {}) as UserPreferences;
          if (prefs.language && (prefs.language === "en" || prefs.language === "pt")) {
            setSelectedLanguage(prefs.language);
          } else {
            setSelectedLanguage(locale);
          }
          setDefaultSport(prefs.default_sport || "all");
          setHapticsEnabled(prefs.haptics_enabled !== false);
          setSoundEnabled(prefs.sound_enabled !== false);
          const notif = prefs.notifications || {};
          setNotifAllEnabled(notif.enabled !== false);
          setNotifUmpireInvited(notif.umpire_invited !== false);
          setNotifMatchStarted(notif.match_started !== false);
          setNotifMatchEnded(notif.match_ended !== false);
          setNotifTennisEnabled(notif.tennis_padel_enabled !== false);
          setNotifTennisSets(
            notif.tennis_padel_sets !== undefined
              ? notif.tennis_padel_sets
              : notif.tennis_padel_granularity !== "none"
          );
          setNotifTennisGames(
            notif.tennis_padel_games !== undefined
              ? notif.tennis_padel_games
              : notif.tennis_padel_granularity === "game"
          );
          setNotifVolleyEnabled(notif.volleyball_enabled !== false);
          setNotifVolleySets(
            notif.volleyball_sets !== undefined
              ? notif.volleyball_sets
              : notif.volleyball_granularity !== "none"
          );
          setNotifVolleyPoints(
            notif.volleyball_points !== undefined
              ? notif.volleyball_points
              : notif.volleyball_granularity === "point"
          );
          setNotifFootballEnabled(notif.football_enabled !== false);
          setNotifFootballGoals(notif.football_goals !== false);
          setNotifFootballCards(notif.football_cards !== false);
          setNotifBasketballEnabled(notif.basketball_enabled !== false);
          setNotifBasketballPoints(notif.basketball_points !== false);
          setNotifBasketballQuarters(notif.basketball_quarters !== false);
        }

        const { data: subData } = await supabase.rpc("get_my_subscription");
        if (subData) {
          setSubDetails(subData);
          if (subData.tier) {
            setSubscriptionTier(subData.tier);
          }
        }
      } catch (e) {
        console.error("Error fetching settings:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        toast.success(
          locale === "pt"
            ? "Bem-vindo ao ScoreBoard Pro Organizer!"
            : "Welcome to ScoreBoard Pro Organizer!"
        );
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [user?.id, supabase, locale]);

  const handleOpenBillingPortal = async () => {
    try {
      setOpeningPortal(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(locale === "pt" ? "Inicie sessão primeiro" : "Please log in first");
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.origin,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.url || !isValidStripeRedirectUrl(data.url)) {
        throw new Error(data?.error || "Failed to load billing portal");
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error("Portal error:", err);
      toast.error(err.message || (locale === "pt" ? "Erro ao abrir portal de pagamentos" : "Error opening billing portal"));
    } finally {
      setOpeningPortal(false);
    }
  };

  // Tab 1: Handle Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedDisplayName = displayName.trim();

    if (!trimmedUsername) {
      toast.error(t("settings.profile.errorEmptyUsername"));
      return;
    }

    const usernameChanged = trimmedUsername !== initialUsername.toLowerCase();
    const displayNameChanged = trimmedDisplayName !== initialDisplayName;

    if (!usernameChanged && !displayNameChanged) {
      toast.info(locale === "pt" ? "Sem alterações para guardar" : "No changes to save");
      return;
    }

    setSavingProfile(true);
    try {
      if (usernameChanged) {
        const { data: existingUser, error: checkError } = await supabase
          .from("users")
          .select("id")
          .ilike("username", trimmedUsername)
          .neq("id", user.id)
          .maybeSingle();

        if (checkError) {
          console.warn("Could not verify unique username:", checkError.message);
        }

        if (existingUser) {
          toast.error(t("settings.profile.errorUsernameTaken"));
          setSavingProfile(false);
          return;
        }
      }

      const { error } = await supabase
        .from("users")
        .update({
          username: trimmedUsername,
          display_name: trimmedDisplayName || trimmedUsername,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        toast.error(`${locale === "pt" ? "Erro ao atualizar perfil" : "Failed to update profile"}: ${error.message}`);
      } else {
        setInitialUsername(trimmedUsername);
        setUsername(trimmedUsername);
        setInitialDisplayName(trimmedDisplayName || trimmedUsername);
        setDisplayName(trimmedDisplayName || trimmedUsername);
        toast.success(t("settings.profile.success"));
      }
    } catch {
      toast.error(locale === "pt" ? "Erro inesperado ao guardar o perfil." : "An unexpected error occurred while saving profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Tab 2: Handle Preferences Save
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingPreferences(true);
    try {
      const updatedPrefs: UserPreferences = {
        language: selectedLanguage,
        default_sport: defaultSport === "all" ? null : defaultSport,
        haptics_enabled: hapticsEnabled,
        sound_enabled: soundEnabled,
        notifications: {
          enabled: notifAllEnabled,
          umpire_invited: notifUmpireInvited,
          match_started: notifMatchStarted,
          match_ended: notifMatchEnded,
          tennis_padel_enabled: notifTennisEnabled,
          tennis_padel_sets: notifTennisSets,
          tennis_padel_games: notifTennisGames,
          volleyball_enabled: notifVolleyEnabled,
          volleyball_sets: notifVolleySets,
          volleyball_points: notifVolleyPoints,
          football_enabled: notifFootballEnabled,
          football_goals: notifFootballGoals,
          football_cards: notifFootballCards,
          basketball_enabled: notifBasketballEnabled,
          basketball_points: notifBasketballPoints,
          basketball_quarters: notifBasketballQuarters,
        },
      };

      const { error } = await supabase
        .from("users")
        .update({
          preferences: updatedPrefs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        toast.error(`${locale === "pt" ? "Erro ao guardar preferências" : "Failed to save preferences"}: ${error.message}`);
      } else {
        setLocale(selectedLanguage);
        toast.success(t("settings.preferences.saved"));
      }
    } catch {
      toast.error(locale === "pt" ? "Erro ao atualizar preferências." : "Error updating preferences.");
    } finally {
      setSavingPreferences(false);
    }
  };

  // Tab 3: Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!currentPassword) {
      toast.error(t("settings.security.currentPasswordRequired"));
      return;
    }

    setSavingPassword(true);
    try {
      if (user.email) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (authError) {
          toast.error(t("settings.security.currentPasswordIncorrect"));
          setSavingPassword(false);
          return;
        }
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        toast.error(t("settings.security.passwordLength"));
        setSavingPassword(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error(t("settings.security.passwordMismatch"));
        setSavingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("settings.security.passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast.error(locale === "pt" ? "Erro ao atualizar palavra-passe." : "Error updating password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Tab 3: Handle GDPR Data Portability Export
  const handleExportData = async () => {
    if (!user) return;

    setExportingData(true);
    try {
      const { data, error } = await supabase.rpc("export_user_data");

      if (error) {
        toast.error(`${locale === "pt" ? "Erro na exportação" : "Export failed"}: ${error.message}`);
        return;
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
      const downloadAnchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `scoreboard-data-export-${timestamp}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success(t("settings.security.exportSuccess"));
    } catch {
      toast.error(locale === "pt" ? "Falha ao gerar exportação de dados." : "Failed to generate data export.");
    } finally {
      setExportingData(false);
    }
  };

  // Tab 4: Handle Account Deletion (GDPR Article 17)
  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteErrorMessage(null);

    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setDeleteErrorMessage(locale === "pt" ? "Por favor escreve DELETE para confirmar." : "Please type DELETE to confirm.");
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");

      if (error) {
        setDeleteErrorMessage(error.message);
        toast.error(error.message);
        setIsDeleting(false);
        return;
      }

      toast.success(t("settings.danger.deleteSuccess"));
      await signOut();
      router.push("/");
    } catch (e: any) {
      const msg = e?.message || (locale === "pt" ? "Erro ao eliminar conta." : "Error deleting account.");
      setDeleteErrorMessage(msg);
      toast.error(msg);
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <DetailPageSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-semibold mb-2">Access Restricted</h1>
        <p className="text-text-muted mb-6 text-xs">Please sign in to access your account settings.</p>
        <Link
          href="/"
          className="bg-text-primary text-surface-container-lowest px-5 py-2 rounded-lg font-medium text-xs hover:bg-white transition-colors"
        >
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary font-sans py-6 sm:py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] leading-none">arrow_back</span>
            <span>{locale === "pt" ? "Voltar ao Início" : "Back to Home"}</span>
          </Link>
        </div>

        {/* Page Header */}
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
            {t("settings.title")}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {t("settings.subtitle")}
          </p>
        </header>

        {/* Tab Selection Bar */}
        <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant mb-8 overflow-x-auto no-scrollbar gap-1 max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "profile"
                ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t("settings.tabs.profile")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preferences")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "preferences"
                ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t("settings.tabs.preferences")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notifications")}
            data-testid="settings-tab-notifications"
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "notifications"
                ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t("settings.notifications.title")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "security"
                ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t("settings.tabs.security")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("danger")}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "danger"
                ? "bg-error/15 text-error border border-error/30 shadow-sm"
                : "text-text-muted hover:text-error"
            }`}
          >
            {t("settings.tabs.danger")}
          </button>
        </div>

        {/* TAB 1: Profile & Identity */}
        {activeTab === "profile" && (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
            <h2 className="text-lg font-semibold text-text-primary mb-1">{t("settings.tabs.profile")}</h2>
            <p className="text-xs text-text-muted mb-6">
              {locale === "pt"
                ? "Gere o teu identificador público e informações visíveis em torneios e tabelas classificativas."
                : "Manage your public handle and display information visible across tournaments and scoreboards."}
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-5">
              {/* Email Address (View only) */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.profile.email")}
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-muted font-medium text-xs opacity-60 cursor-not-allowed"
                />
                <p className="text-[11px] text-text-muted mt-1">{t("settings.profile.emailNotice")}</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.profile.username")}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("settings.profile.usernamePlaceholder")}
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs outline-none focus:border-outline transition-colors"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.profile.displayName")}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("settings.profile.displayNamePlaceholder")}
                  className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs outline-none focus:border-outline transition-colors"
                />
              </div>

              {/* Subscription Tier */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.profile.tier")}
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-lg border border-outline-variant">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        subscriptionTier === "pro" ? "bg-emerald-400" : "bg-text-muted"
                      }`}
                    />
                    <span className="text-xs font-medium text-text-primary uppercase tracking-wide">
                      {subscriptionTier} Plan
                    </span>
                  </div>

                  {subscriptionTier === "free" ? (
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-primary text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-amber-400">star</span>
                      <span>{locale === "pt" ? "Aderir ao Pro Organizer (€3.99/mês)" : "Upgrade to Pro (€3.99/mo)"}</span>
                    </button>
                  ) : subDetails?.provider === "stripe" ? (
                    <button
                      type="button"
                      onClick={handleOpenBillingPortal}
                      disabled={openingPortal}
                      className="bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-primary text-xs font-medium px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {openingPortal ? (
                        <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-text-primary rounded-full animate-spin" />
                      ) : (
                        <span>{locale === "pt" ? "Gerir Faturação / Cancelar" : "Manage Billing & Cards"}</span>
                      )}
                    </button>
                  ) : subDetails?.provider === "voucher" ? (
                    <div className="flex items-center gap-2.5 bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant">
                      <div className="text-xs font-medium text-text-primary">
                        <span>{locale === "pt" ? "Ativo via Voucher" : "Active via Club Voucher"}</span>
                        {subDetails.current_period_end && (
                          <span className="block text-[10px] text-text-muted">
                            {locale === "pt" ? "Válido até: " : "Valid until: "}
                            {new Date(subDetails.current_period_end).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-xs text-text-muted hover:text-text-primary underline cursor-pointer ml-1"
                      >
                        {locale === "pt" ? "Ativar outro" : "Redeem another"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-surface-container-high px-3 py-1.5 rounded-lg border border-outline-variant">
                      <div className="text-xs font-medium text-text-primary">
                        <span>{locale === "pt" ? "Acesso Pro Ativo" : "Active Pro Organizer"}</span>
                        <span className="block text-[10px] text-text-muted">
                          {locale === "pt" ? "Todas as ferramentas de torneios desbloqueadas" : "Full tournament & referee tools unlocked"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-xs text-text-muted hover:text-text-primary underline cursor-pointer ml-1"
                      >
                        {locale === "pt" ? "Resgatar voucher" : "Redeem voucher"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {savingProfile ? t("settings.profile.saving") : t("settings.profile.saveChanges")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Preferences */}
        {activeTab === "preferences" && (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
            <h2 className="text-lg font-semibold text-text-primary mb-1">{t("settings.preferences.title")}</h2>
            <p className="text-xs text-text-muted mb-6">{t("settings.preferences.description")}</p>

            <form onSubmit={handleSavePreferences} className="space-y-5">
              {/* Language Selection */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.preferences.language")}
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage("en")}
                    className={`p-3 rounded-lg border flex items-center justify-between transition-colors cursor-pointer text-xs font-medium ${
                      selectedLanguage === "en"
                        ? "border-outline-variant bg-surface-container-high text-text-primary shadow-sm"
                        : "border-outline-variant bg-surface-container text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <span>English</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container-highest text-text-muted">EN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLanguage("pt")}
                    className={`p-3 rounded-lg border flex items-center justify-between transition-colors cursor-pointer text-xs font-medium ${
                      selectedLanguage === "pt"
                        ? "border-outline-variant bg-surface-container-high text-text-primary shadow-sm"
                        : "border-outline-variant bg-surface-container text-text-muted hover:text-text-primary"
                    }`}
                  >
                    <span>Português</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-container-highest text-text-muted">PT</span>
                  </button>
                </div>
              </div>

              {/* Default Sport Filter */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  {t("settings.preferences.defaultSport")}
                </label>
                <SelectField
                  value={defaultSport}
                  onChange={setDefaultSport}
                  className="w-full max-w-md"
                  options={[
                    { value: "all", label: t("settings.preferences.allSports") },
                    ...SUPPORTED_SPORTS.map((s) => ({
                      value: s.slug,
                      label: t(`sports.${s.i18nKey}`),
                    })),
                  ]}
                />
              </div>

              {/* Sound Feedback */}
              <div>
                <div className="flex items-center justify-between max-w-md p-3.5 bg-surface-container-high rounded-lg border border-outline-variant">
                  <div>
                    <span className="block text-xs font-medium text-text-primary">
                      {t("settings.preferences.soundEffects")}
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      {t("settings.preferences.soundDesc")}
                    </span>
                  </div>
                  <ToggleSwitch
                    checked={soundEnabled}
                    onChange={setSoundEnabled}
                    ariaLabel={t("settings.preferences.soundEffects")}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPreferences}
                  className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {savingPreferences ? t("settings.profile.saving") : t("settings.preferences.savePreferences")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2b: Notifications */}
        {activeTab === "notifications" && (
          <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant" data-testid="web-notification-settings">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">{t("settings.notifications.title")}</h2>
                <p className="text-xs text-text-muted">
                  {locale === "pt"
                    ? "Escolhe quais os alertas globais e por modalidade que pretendes receber."
                    : "Choose which global and sport-specific alerts you want to receive."}
                </p>
              </div>
              <ToggleSwitch
                checked={notifAllEnabled}
                onChange={setNotifAllEnabled}
                ariaLabel={t("settings.notifications.allEnabled")}
                testId="web-notif-switch-all"
              />
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-6">
              <div
                className={`space-y-6 transition-opacity ${
                  notifAllEnabled ? "" : "opacity-45 pointer-events-none"
                }`}
              >
              {/* Global / Generic Notifications */}
              <div className="space-y-2.5 max-w-md">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {t("settings.notifications.generalTitle")}
                </p>

                <div className="flex items-center justify-between gap-4 p-3.5 bg-surface-container-high rounded-lg border border-outline-variant">
                  <div>
                    <span className="block text-xs font-medium text-text-primary">
                      {t("settings.notifications.umpireInvited")}
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      {t("settings.notifications.umpireInvitedDesc")}
                    </span>
                  </div>
                  <ToggleSwitch
                    checked={notifUmpireInvited}
                    onChange={setNotifUmpireInvited}
                    ariaLabel={t("settings.notifications.umpireInvited")}
                    testId="web-notif-switch-umpire"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3.5 bg-surface-container-high rounded-lg border border-outline-variant">
                  <div>
                    <span className="block text-xs font-medium text-text-primary">
                      {t("settings.notifications.matchStarted")}
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      {t("settings.notifications.matchStartedDesc")}
                    </span>
                  </div>
                  <ToggleSwitch
                    checked={notifMatchStarted}
                    onChange={setNotifMatchStarted}
                    ariaLabel={t("settings.notifications.matchStarted")}
                    testId="web-notif-switch-started"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-3.5 bg-surface-container-high rounded-lg border border-outline-variant">
                  <div>
                    <span className="block text-xs font-medium text-text-primary">
                      {t("settings.notifications.matchEnded")}
                    </span>
                    <span className="block text-[11px] text-text-muted mt-0.5">
                      {t("settings.notifications.matchEndedDesc")}
                    </span>
                  </div>
                  <ToggleSwitch
                    checked={notifMatchEnded}
                    onChange={setNotifMatchEnded}
                    ariaLabel={t("settings.notifications.matchEnded")}
                    testId="web-notif-switch-ended"
                  />
                </div>
              </div>

              {/* Sport-Specific Notifications */}
              <div className="space-y-4 max-w-md pt-2 border-t border-outline-variant">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted pt-2">
                  {t("settings.notifications.sportSpecificTitle")}
                </p>

                <div className="space-y-4">
                  {/* Tennis & Padel */}
                  <div className="rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low">
                    <div className="bg-surface-container-highest px-4 py-2.5 border-b border-outline-variant flex items-center justify-between gap-4">
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-text-primary">
                          {t("settings.notifications.tennisPadel")}
                        </span>
                        <span className="block text-[11px] text-text-muted mt-0.5">
                          {t("settings.notifications.tennisPadelHint")}
                        </span>
                      </div>
                      <ToggleSwitch
                        checked={notifTennisEnabled}
                        onChange={setNotifTennisEnabled}
                        ariaLabel={t("settings.notifications.tennisPadel")}
                        testId="web-notif-switch-tennis-all"
                      />
                    </div>
                    <div
                      className={`px-4 py-1 divide-y divide-outline-variant/60 transition-opacity ${
                        notifTennisEnabled ? "" : "opacity-45 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.tennisPadelSets")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.tennisPadelSetsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifTennisSets}
                          onChange={setNotifTennisSets}
                          ariaLabel={t("settings.notifications.tennisPadelSets")}
                          testId="web-notif-switch-tennis-sets"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.tennisPadelGames")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.tennisPadelGamesDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifTennisGames}
                          onChange={setNotifTennisGames}
                          ariaLabel={t("settings.notifications.tennisPadelGames")}
                          testId="web-notif-switch-tennis-games"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Volleyball */}
                  <div className="rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low">
                    <div className="bg-surface-container-highest px-4 py-2.5 border-b border-outline-variant flex items-center justify-between gap-4">
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-primary">
                        {t("settings.notifications.volleyball")}
                      </span>
                      <ToggleSwitch
                        checked={notifVolleyEnabled}
                        onChange={setNotifVolleyEnabled}
                        ariaLabel={t("settings.notifications.volleyball")}
                        testId="web-notif-switch-volley-all"
                      />
                    </div>
                    <div
                      className={`px-4 py-1 divide-y divide-outline-variant/60 transition-opacity ${
                        notifVolleyEnabled ? "" : "opacity-45 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.volleyballSets")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.volleyballSetsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifVolleySets}
                          onChange={setNotifVolleySets}
                          ariaLabel={t("settings.notifications.volleyballSets")}
                          testId="web-notif-switch-volley-sets"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.volleyballPoints")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.volleyballPointsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifVolleyPoints}
                          onChange={setNotifVolleyPoints}
                          ariaLabel={t("settings.notifications.volleyballPoints")}
                          testId="web-notif-switch-volley-points"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Football */}
                  <div className="rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low">
                    <div className="bg-surface-container-highest px-4 py-2.5 border-b border-outline-variant flex items-center justify-between gap-4">
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-primary">
                        {t("settings.notifications.football")}
                      </span>
                      <ToggleSwitch
                        checked={notifFootballEnabled}
                        onChange={setNotifFootballEnabled}
                        ariaLabel={t("settings.notifications.football")}
                        testId="web-notif-switch-football-all"
                      />
                    </div>
                    <div
                      className={`px-4 py-1 divide-y divide-outline-variant/60 transition-opacity ${
                        notifFootballEnabled ? "" : "opacity-45 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.footballGoals")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.footballGoalsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifFootballGoals}
                          onChange={setNotifFootballGoals}
                          ariaLabel={t("settings.notifications.footballGoals")}
                          testId="web-notif-switch-football-goals"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.footballCards")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.footballCardsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifFootballCards}
                          onChange={setNotifFootballCards}
                          ariaLabel={t("settings.notifications.footballCards")}
                          testId="web-notif-switch-football-cards"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Basketball */}
                  <div className="rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low">
                    <div className="bg-surface-container-highest px-4 py-2.5 border-b border-outline-variant flex items-center justify-between gap-4">
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-primary">
                        {t("settings.notifications.basketball")}
                      </span>
                      <ToggleSwitch
                        checked={notifBasketballEnabled}
                        onChange={setNotifBasketballEnabled}
                        ariaLabel={t("settings.notifications.basketball")}
                        testId="web-notif-switch-basketball-all"
                      />
                    </div>
                    <div
                      className={`px-4 py-1 divide-y divide-outline-variant/60 transition-opacity ${
                        notifBasketballEnabled ? "" : "opacity-45 pointer-events-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.basketballPoints")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.basketballPointsDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifBasketballPoints}
                          onChange={setNotifBasketballPoints}
                          ariaLabel={t("settings.notifications.basketballPoints")}
                          testId="web-notif-switch-basketball-points"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <div>
                          <span className="block text-xs font-medium text-text-primary">
                            {t("settings.notifications.basketballQuarters")}
                          </span>
                          <span className="block text-[11px] text-text-muted">
                            {t("settings.notifications.basketballQuartersDesc")}
                          </span>
                        </div>
                        <ToggleSwitch
                          checked={notifBasketballQuarters}
                          onChange={setNotifBasketballQuarters}
                          ariaLabel={t("settings.notifications.basketballQuarters")}
                          testId="web-notif-switch-basketball-quarters"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPreferences}
                  data-testid="web-save-notif-prefs-btn"
                  className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {savingPreferences ? t("settings.profile.saving") : t("settings.preferences.savePreferences")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: Security & Credentials */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {/* Change Password Card */}
            <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
              <h2 className="text-lg font-semibold text-text-primary mb-1">{t("settings.security.changePassword")}</h2>
              <p className="text-xs text-text-muted mb-6">
                {locale === "pt"
                  ? "Atualiza as tuas credenciais de início de sessão de forma segura."
                  : "Update your login credentials securely."}
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    {t("settings.security.currentPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs outline-none focus:border-outline transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    {t("settings.security.newPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs outline-none focus:border-outline transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    {t("settings.security.confirmPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-outline-variant text-text-primary font-medium text-xs outline-none focus:border-outline transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="bg-text-primary hover:bg-white text-surface-container-lowest px-5 py-2.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {savingPassword ? t("settings.profile.saving") : t("settings.security.updatePassword")}
                  </button>
                </div>
              </form>
            </div>

            {/* GDPR Data Portability Card */}
            <div className="bg-surface-container rounded-2xl p-6 sm:p-8 border border-outline-variant">
              <h2 className="text-lg font-semibold text-text-primary mb-1">{t("settings.security.exportTitle")}</h2>
              <p className="text-xs text-text-muted mb-5 leading-relaxed max-w-2xl">
                {t("settings.security.exportDesc")}
              </p>

              <button
                type="button"
                onClick={handleExportData}
                disabled={exportingData}
                className="bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant text-text-primary px-4 py-2.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                {exportingData ? t("settings.security.exporting") : t("settings.security.downloadData")}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Danger Zone */}
        {activeTab === "danger" && (
          <div className="bg-error/5 border border-error/20 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-error mb-1">{t("settings.danger.title")}</h2>
            <p className="text-xs text-text-muted mb-2 leading-relaxed max-w-2xl">
              {t("settings.danger.deleteWarning")}
            </p>
            <p className="text-xs text-error font-medium mb-5 max-w-2xl">
              {t("settings.danger.deleteConsequence")}
            </p>

            {deleteErrorMessage && (
              <div className="p-3 mb-5 rounded-lg bg-error/10 border border-error/20 text-error text-xs font-medium">
                {deleteErrorMessage}
              </div>
            )}

            <div className="max-w-md space-y-4">
              <label className="block text-xs font-medium text-text-secondary">
                {t("settings.danger.confirmPrompt")}
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border border-error/30 text-text-primary font-mono text-xs outline-none focus:border-error transition-colors"
              />

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                className="bg-error hover:bg-error/90 text-white px-5 py-2.5 rounded-lg font-medium text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDeleting ? t("settings.danger.deleting") : t("settings.danger.confirmButton")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UPGRADE / PAYWALL MODAL */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        isAlreadyPro={subscriptionTier === "pro"}
        onSuccess={() => {
          setSubscriptionTier("pro");
        }}
      />
    </div>
  );
}
