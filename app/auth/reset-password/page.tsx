"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n";
import { validatePassword } from "@/lib/auth/passwordValidation";
import { toast } from "sonner";

function ResetPasswordContent() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then((res: any) => {
      const session = res?.data?.session;
      if (session) {
        setIsReady(true);
      } else {
        // Listen to auth state in case token is being exchanged from hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, s: any) => {
          if (s) {
            setIsReady(true);
          }
        });
        // Allow user to still view form after small timeout if session restored
        const timer = setTimeout(() => setIsReady(true), 1200);
        return () => {
          subscription.unsubscribe();
          clearTimeout(timer);
        };
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setErrorMsg(t("auth.passwordRequirements"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t("auth.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMsg(error.message);
      } else {
        toast.success(t("auth.passwordResetSuccess"));
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || (locale === "pt" ? "Erro ao atualizar palavra-passe." : "Error updating password."));
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <h2 className="font-headline text-2xl font-black uppercase tracking-tight text-on-surface mb-2">
          {locale === "pt" ? "A verificar autorização..." : "Verifying authorization..."}
        </h2>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
      <div className="text-center mb-6">
        <h1 className="font-headline text-2xl font-black uppercase tracking-tight text-on-surface mb-2">
          {t("auth.resetPassword")}
        </h1>
        <p className="text-xs text-on-surface-variant">
          {locale === "pt"
            ? "Introduz a tua nova palavra-passe de acesso."
            : "Enter your new account password below."}
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs text-center font-medium">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
            {t("auth.newPassword")}
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("auth.newPasswordPlaceholder")}
            required
            className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
          />
          <p className="text-[11px] text-on-surface-variant/70 mt-1 leading-snug">
            {t("auth.passwordRequirements")}
          </p>
        </div>

        <div>
          <label className="block font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1">
            {t("auth.confirmPassword")}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("auth.confirmPasswordPlaceholder")}
            required
            className="w-full bg-surface-container text-on-surface px-4 py-3 rounded-2xl border border-outline-variant/10 outline-none focus:border-primary transition-colors text-sm font-medium"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-on-primary py-3.5 rounded-2xl font-label text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-primary/20 mt-2"
        >
          {loading ? t("auth.processing") : t("auth.updatePasswordBtn")}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-xs text-on-surface-variant hover:text-primary transition-colors"
        >
          {t("auth.backToSignIn")}
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
