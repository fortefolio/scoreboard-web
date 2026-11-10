"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { type EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    if (!token_hash || !type) {
      setStatus("error");
      setErrorMessage("Parâmetros de confirmação em falta.");
      return;
    }

    const verify = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash,
        });

        if (error) {
          setStatus("error");
          setErrorMessage(error.message);
        } else {
          setStatus("success");

          // Attempt automatic deep link redirect on mobile devices
          const isMobile =
            /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

          if (isMobile) {
            setTimeout(() => {
              window.location.href =
                type === "recovery"
                  ? "scoreboard://auth/reset-password"
                  : "scoreboard://auth/callback";
            }, 600);
          } else if (type === "recovery") {
            setTimeout(() => {
              window.location.href = "/auth/reset-password";
            }, 1000);
          }
        }
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(err?.message || "Erro inesperado ao verificar conta.");
      }
    };

    verify();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto mb-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <h2 className="font-headline text-2xl font-black uppercase tracking-tight text-on-surface mb-2">
          A Verificar Conta...
        </h2>
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/70">
          Verifying Account
        </p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-headline text-3xl font-black uppercase tracking-tight text-on-surface mb-2">
          Conta Confirmada!
        </h1>
        <p className="font-label text-xs uppercase tracking-widest text-emerald-400 font-bold mb-4">
          Account Verified
        </p>

        <p className="text-sm text-on-surface-variant/80 mb-8 leading-relaxed">
          O teu email foi verificado com sucesso. Podes agora aceder ao ScoreBoard na aplicação móvel ou no navegador.
        </p>

        <div className="space-y-3">
          <a
            href="scoreboard://auth/callback"
            className="block w-full bg-primary text-on-primary py-3.5 rounded-2xl font-label text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            Abrir na App ScoreBoard
          </a>

          <Link
            href="/"
            className="block w-full bg-surface-container hover:bg-surface-container-high text-on-surface py-3.5 rounded-2xl font-label text-xs font-bold uppercase tracking-wider border border-outline-variant/10 transition-colors"
          >
            Continuar na Web
          </Link>
        </div>

        <p className="text-[11px] text-on-surface-variant/50 mt-6">
          Se estiveres num telemóvel com a app instalada, a app abrirá automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h1 className="font-headline text-2xl font-black uppercase tracking-tight text-on-surface mb-2">
        Ligação Inválida ou Expirada
      </h1>
      <p className="font-label text-xs uppercase tracking-widest text-amber-400 font-bold mb-4">
        Link Expired
      </p>

      <p className="text-sm text-on-surface-variant/80 mb-8 leading-relaxed">
        {errorMessage || "Esta ligação de confirmação já foi utilizada ou expirou. Se a tua conta já estiver confirmada, podes iniciar sessão normalmente."}
      </p>

      <Link
        href="/"
        className="block w-full bg-primary text-on-primary py-3.5 rounded-2xl font-label text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
      >
        Ir para o ScoreBoard
      </Link>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <h2 className="font-headline text-2xl font-black uppercase tracking-tight text-on-surface mb-2">
              A Carregar...
            </h2>
          </div>
        }
      >
        <ConfirmContent />
      </Suspense>
    </div>
  );
}
