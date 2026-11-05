"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Locale } from "@/lib/i18n/types";
import { toast } from "sonner";
import UpgradeModal from "@/components/subscription/UpgradeModal";
import { validatePassword } from "@/lib/auth/passwordValidation";

type TabType = "profile" | "preferences" | "security" | "danger";

interface UserPreferences {
  language?: Locale;
  default_sport?: string | null;
  sound_enabled?: boolean;
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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Security Tab State
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
          setSoundEnabled(prefs.sound_enabled !== false);
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
      if (!res.ok || !data?.url) {
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
        sound_enabled: soundEnabled,
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

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast.error(t("settings.security.passwordLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("settings.security.passwordMismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success(t("settings.security.passwordUpdated"));
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-on-background flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-black mb-4 uppercase tracking-tight">Access Restricted</h1>
        <p className="text-secondary mb-6 font-bold">Please sign in to access your account settings.</p>
        <Link
          href="/"
          className="bg-primary text-on-primary px-8 py-3 rounded-full font-black uppercase tracking-widest text-xs hover:brightness-110"
        >
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background font-body p-6 md:p-12 pt-24">
      <div className="max-w-4xl mx-auto">
        {/* Navigation Breadcrumb / Back Link */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-secondary hover:text-primary transition-colors"
          >
            ← {locale === "pt" ? "Voltar ao Início" : "Back to Home"}
          </Link>
        </div>

        {/* Page Header */}
        <header className="mb-10">
          <p className="text-secondary font-label text-xs uppercase tracking-[0.25em] mb-2">
            {t("settings.subtitle")}
          </p>
          <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tight text-on-surface">
            {t("settings.title").toUpperCase()}
          </h1>
        </header>

        {/* Tab Selection Bar */}
        <div className="flex border-b border-outline-variant/20 mb-8 overflow-x-auto no-scrollbar gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
            }`}
          >
            {t("settings.tabs.profile")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preferences")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "preferences"
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
            }`}
          >
            {t("settings.tabs.preferences")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "security"
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
            }`}
          >
            {t("settings.tabs.security")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("danger")}
            className={`pb-4 px-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "danger"
                ? "border-error text-error"
                : "border-transparent text-secondary hover:text-error/80"
            }`}
          >
            {t("settings.tabs.danger")}
          </button>
        </div>

        {/* TAB 1: Profile & Identity */}
        {activeTab === "profile" && (
          <div className="bg-surface-container-low rounded-3xl p-6 md:p-10 border border-outline-variant/10 shadow-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-2">{t("settings.tabs.profile")}</h2>
            <p className="text-xs text-secondary mb-8">
              {locale === "pt"
                ? "Gere o teu identificador público e informações visíveis em torneios e tabelas classificativas."
                : "Manage your public handle and display information visible across tournaments and scoreboards."}
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Email Address (View only) */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.profile.email")}
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ""}
                  className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface-variant font-bold opacity-60 cursor-not-allowed"
                />
                <p className="text-[11px] text-secondary mt-1.5">{t("settings.profile.emailNotice")}</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.profile.username")}
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("settings.profile.usernamePlaceholder")}
                  className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.profile.displayName")}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("settings.profile.displayNamePlaceholder")}
                  className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>

              {/* Subscription Tier */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.profile.tier")}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-3 px-5 py-3 bg-surface-container rounded-2xl border border-outline-variant/10">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        subscriptionTier === "pro" ? "bg-emerald-400" : "bg-indigo-400"
                      }`}
                    />
                    <span className="text-xs font-black uppercase tracking-widest text-on-surface">
                      {subscriptionTier.toUpperCase()} PLAN
                    </span>
                  </div>

                  {subscriptionTier === "free" ? (
                    <button
                      type="button"
                      onClick={() => setShowUpgradeModal(true)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      ⭐ {locale === "pt" ? "Aderir ao Pro Organizer (€3.99/mês)" : "Upgrade to Pro (€3.99/mo)"}
                    </button>
                  ) : subDetails?.provider === "stripe" ? (
                    <button
                      type="button"
                      onClick={handleOpenBillingPortal}
                      disabled={openingPortal}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider px-5 py-3 rounded-2xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {openingPortal ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span>💳 {locale === "pt" ? "Gerir Faturação / Cancelar" : "Manage Billing & Cards"}</span>
                      )}
                    </button>
                  ) : subDetails?.provider === "voucher" ? (
                    <div className="flex items-center gap-3 bg-surface-container/60 px-4 py-2.5 rounded-2xl border border-emerald-500/20">
                      <div className="text-xs">
                        <span className="text-emerald-400 font-bold">🎟️ {locale === "pt" ? "Ativo via Voucher" : "Active via Club Voucher"}</span>
                        {subDetails.current_period_end && (
                          <span className="block text-[10px] text-slate-400">
                            {locale === "pt" ? "Válido até: " : "Valid until: "}
                            {new Date(subDetails.current_period_end).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer ml-2"
                      >
                        {locale === "pt" ? "Ativar outro" : "Redeem another"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-surface-container/60 px-4 py-2.5 rounded-2xl border border-indigo-500/20">
                      <div className="text-xs">
                        <span className="text-indigo-300 font-bold">⭐ {locale === "pt" ? "Acesso Pro Ativo" : "Active Pro Organizer"}</span>
                        <span className="block text-[10px] text-slate-400">
                          {locale === "pt" ? "Todas as ferramentas de torneios desbloqueadas" : "Full tournament & referee tools unlocked"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowUpgradeModal(true)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer ml-2"
                      >
                        {locale === "pt" ? "Resgatar voucher" : "Redeem voucher"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-primary text-on-primary px-8 py-3.5 rounded-full font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {savingProfile ? t("settings.profile.saving") : t("settings.profile.saveChanges")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Preferences */}
        {activeTab === "preferences" && (
          <div className="bg-surface-container-low rounded-3xl p-6 md:p-10 border border-outline-variant/10 shadow-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-2">{t("settings.preferences.title")}</h2>
            <p className="text-xs text-secondary mb-8">{t("settings.preferences.description")}</p>

            <form onSubmit={handleSavePreferences} className="space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.preferences.language")}
                </label>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage("en")}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      selectedLanguage === "en"
                        ? "border-primary bg-primary/10 text-on-surface"
                        : "border-outline-variant/10 bg-surface-container text-secondary hover:border-outline-variant/30"
                    }`}
                  >
                    <span className="font-bold text-sm">English</span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-surface-container-high">EN</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedLanguage("pt")}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                      selectedLanguage === "pt"
                        ? "border-primary bg-primary/10 text-on-surface"
                        : "border-outline-variant/10 bg-surface-container text-secondary hover:border-outline-variant/30"
                    }`}
                  >
                    <span className="font-bold text-sm">Português</span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-surface-container-high">PT</span>
                  </button>
                </div>
              </div>

              {/* Default Sport Filter */}
              <div>
                <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                  {t("settings.preferences.defaultSport")}
                </label>
                <select
                  value={defaultSport}
                  onChange={(e) => setDefaultSport(e.target.value)}
                  className="w-full max-w-md px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary transition-all"
                >
                  <option value="all">{t("settings.preferences.allSports")}</option>
                  <option value="volleyball">Volleyball</option>
                  <option value="beach_volleyball">Beach Volleyball</option>
                  <option value="tennis">Tennis</option>
                  <option value="padel">Padel</option>
                  <option value="basketball">Basketball</option>
                  <option value="football">Football / Soccer</option>
                </select>
              </div>

              {/* Sound Feedback */}
              <div className="pt-2">
                <div className="flex items-center justify-between max-w-md p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                  <div>
                    <span className="block text-sm font-bold text-on-surface">
                      {t("settings.preferences.soundEffects")}
                    </span>
                    <span className="block text-xs text-secondary mt-0.5">
                      {t("settings.preferences.soundDesc")}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-5 h-5 accent-primary rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={savingPreferences}
                  className="bg-primary text-on-primary px-8 py-3.5 rounded-full font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  {savingPreferences ? t("settings.profile.saving") : t("settings.preferences.savePreferences")}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: Security & Credentials */}
        {activeTab === "security" && (
          <div className="space-y-8">
            {/* Change Password Card */}
            <div className="bg-surface-container-low rounded-3xl p-6 md:p-10 border border-outline-variant/10 shadow-2xl">
              <h2 className="text-xl font-bold text-on-surface mb-2">{t("settings.security.changePassword")}</h2>
              <p className="text-xs text-secondary mb-8">
                {locale === "pt"
                  ? "Atualiza as tuas credenciais de início de sessão de forma segura."
                  : "Update your login credentials securely."}
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
                <div>
                  <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                    {t("settings.security.newPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest mb-2">
                    {t("settings.security.confirmPassword")}
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-outline-variant/10 text-on-surface font-bold outline-none focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="bg-primary text-on-primary px-8 py-3.5 rounded-full font-black uppercase tracking-widest text-xs hover:brightness-110 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {savingPassword ? t("settings.profile.saving") : t("settings.security.updatePassword")}
                  </button>
                </div>
              </form>
            </div>

            {/* GDPR Data Portability Card */}
            <div className="bg-surface-container-low rounded-3xl p-6 md:p-10 border border-outline-variant/10 shadow-2xl">
              <h2 className="text-xl font-bold text-on-surface mb-2">{t("settings.security.exportTitle")}</h2>
              <p className="text-xs text-secondary mb-6 leading-relaxed max-w-2xl">
                {t("settings.security.exportDesc")}
              </p>

              <button
                type="button"
                onClick={handleExportData}
                disabled={exportingData}
                className="bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-on-surface px-6 py-3.5 rounded-full font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exportingData ? t("settings.security.exporting") : t("settings.security.downloadData")}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: Danger Zone */}
        {activeTab === "danger" && (
          <div className="bg-error-container/10 border border-error/30 rounded-3xl p-6 md:p-10 shadow-2xl">
            <h2 className="text-xl font-bold text-error mb-2">{t("settings.danger.title")}</h2>
            <p className="text-xs text-on-surface mb-4 leading-relaxed max-w-2xl">
              {t("settings.danger.deleteWarning")}
            </p>
            <p className="text-xs text-error font-bold mb-6 max-w-2xl">
              {t("settings.danger.deleteConsequence")}
            </p>

            {deleteErrorMessage && (
              <div className="p-4 mb-6 rounded-2xl bg-error/20 border border-error/40 text-error text-xs font-bold">
                ⚠️ {deleteErrorMessage}
              </div>
            )}

            <div className="max-w-md space-y-4">
              <label className="block text-[11px] font-black text-on-surface-variant uppercase tracking-widest">
                {t("settings.danger.confirmPrompt")}
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-5 py-3.5 bg-surface-container rounded-2xl border border-error/40 text-on-surface font-mono font-bold tracking-widest outline-none focus:border-error focus:ring-1 focus:ring-error transition-all"
              />

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation.trim().toUpperCase() !== "DELETE"}
                className="bg-error hover:bg-error/90 text-on-error px-8 py-3.5 rounded-full font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-error/20 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
              >
                {isDeleting ? t("settings.danger.deleting") : t("settings.danger.confirmButton")}
              </button>
            </div>
          </div>
        )}

        {/* Footer Legal Link */}
        <div className="mt-8 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs text-secondary">
          <span>ScoreBoard</span>
          <Link href="/terms" target="_blank" className="hover:text-primary transition-colors underline">
            {locale === "pt" ? "Termos & Condições / Política RGPD" : "Terms & Conditions / GDPR Policy"}
          </Link>
        </div>
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
