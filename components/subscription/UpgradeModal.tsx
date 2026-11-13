"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isAlreadyPro?: boolean;
  source?: string;
}

export default function UpgradeModal({ isOpen, onClose, onSuccess, isAlreadyPro = false, source }: UpgradeModalProps) {
  const { t, locale } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);
  const [showVoucherInput, setShowVoucherInput] = useState(isAlreadyPro);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  if (!isOpen) return null;

  const handleStripeCheckout = async () => {
    try {
      setLoadingCheckout(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error(locale === "pt" ? "Inicie sessão primeiro" : "Please log in first");
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          plan: billingCycle,
          returnUrl: window.location.origin,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to create checkout session");
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error("Stripe Checkout Error:", err);
      toast.error(err.message || (locale === "pt" ? "Erro ao iniciar pagamento" : "Failed to initiate checkout"));
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleRedeemVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = voucherCode.trim().toUpperCase();

    if (!cleanCode) {
      toast.error(locale === "pt" ? "Introduza um código válido" : "Please enter a valid voucher code");
      return;
    }

    try {
      setRedeemingVoucher(true);
      const { data, error } = await supabase.rpc("redeem_voucher", {
        code_input: cleanCode,
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success(
          data.message || (locale === "pt" ? "Voucher ativado com sucesso!" : "Voucher redeemed successfully!")
        );
        setVoucherCode("");
        if (onSuccess) onSuccess();
        onClose();
        window.location.reload();
      } else {
        toast.error(data?.message || (locale === "pt" ? "Código inválido ou expirado" : "Invalid or expired voucher code"));
      }
    } catch (err: any) {
      console.error("Voucher error:", err);
      toast.error(err.message || (locale === "pt" ? "Erro ao validar voucher" : "Error redeeming voucher"));
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const isPt = locale === "pt";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container border border-outline-variant rounded-2xl p-6 sm:p-7 shadow-2xl text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">close</span>
        </button>

        {/* Header */}
        <div className="text-center mb-6 pr-6 pl-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            {isAlreadyPro 
              ? (isPt ? "O seu Plano Pro está Ativo" : "You Are On The Pro Plan")
              : (isPt ? "Crie e Faça a Gestão dos Seus Torneios" : "Host & Manage Your Tournaments")}
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-md mx-auto">
            {isAlreadyPro
              ? (isPt ? "A sua conta já tem todas as funcionalidades Pro desbloqueadas." : "Your account currently has full access to all Pro Organizer features.")
              : (isPt 
                ? "Desbloqueie ferramentas de gestão, escalonamento e partilha para os seus eventos desportivos."
                : "Unlock full tournament brackets, group stages, referee delegation, and broadcast overlays.")}
          </p>
        </div>

        {/* If NOT already pro, show Billing Toggle & Price */}
        {!isAlreadyPro ? (
          <>
            {/* Billing Toggle (Monthly vs Annual) */}
            <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant max-w-xs mx-auto mb-6">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 h-8 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                  billingCycle === "monthly"
                    ? "bg-surface-container text-text-primary border-outline-variant shadow-sm"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                {isPt ? "Mensal" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 h-8 text-xs font-medium rounded-lg border transition-colors relative flex items-center justify-center gap-1.5 cursor-pointer ${
                  billingCycle === "annual"
                    ? "bg-surface-container text-text-primary border-outline-variant shadow-sm"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                <span>{isPt ? "Anual" : "Annual"}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 leading-none rounded bg-surface-container-high text-text-secondary border border-outline-variant">
                  -27%
                </span>
              </button>
            </div>

            {/* Price Tag */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1.5 min-h-[48px]">
                <span className="font-mono text-4xl sm:text-5xl font-bold text-text-primary tracking-tight tabular-nums">
                  {billingCycle === "annual" ? "€34.99" : "€3.99"}
                </span>
                <span className="font-mono text-xs text-text-muted whitespace-nowrap">
                  {billingCycle === "annual" 
                    ? (isPt ? "/ ano (~€2.91/mês)" : "/ year (~€2.91/mo)") 
                    : (isPt ? "/ mês" : "/ month")}
                </span>
              </div>
              <p className="text-[11px] font-mono text-text-muted mt-1">
                {isPt ? "Cancele a qualquer momento. Sem compromissos." : "Cancel anytime. No lock-in."}
              </p>
            </div>
          </>
        ) : (
          <div className="mb-6 bg-surface-container-high border border-outline-variant rounded-xl p-4 text-center">
            <span className="text-text-primary font-medium text-xs block mb-1">
              ✓ {isPt ? "Subscrição Pro Ativa" : "Active Pro Subscription"}
            </span>
            <span className="text-text-muted text-[11px]">
              {isPt 
                ? "Pode criar torneios ilimitados e nomear árbitros livremente."
                : "You can create unlimited competitions and assign match officials."}
            </span>
          </div>
        )}

        {/* Feature List */}
        <div className="space-y-2.5 mb-6 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
          {[
            isPt ? "Criação ilimitada de torneios e ligas" : "Unlimited tournament creation & brackets",
            isPt ? "Fases de grupos + fases a eliminar automatizadas" : "Group stages + knockout brackets support",
            isPt ? "Atribuição e nomeação de árbitros oficiais" : "Official referee & umpire assignments",
            isPt ? "Exportação de resultados e classificações (PDF / CSV)" : "Export fixtures & standings (PDF / CSV)",
            isPt ? "Marcador limpo para transmissões em direto (OBS / vMix)" : "Clean broadcast scoreboard overlay for live streams (OBS / vMix)",
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-text-secondary">
              <span className="material-symbols-outlined text-[15px] text-text-muted shrink-0">check</span>
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Action Button: Subscribe with Stripe (if not pro) or Got It (if pro) */}
        {!isAlreadyPro ? (
          <button
            type="button"
            onClick={handleStripeCheckout}
            disabled={loadingCheckout}
            className="w-full py-3 px-6 rounded-xl bg-text-primary hover:bg-white text-surface-container-lowest font-medium text-xs tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {loadingCheckout ? (
              <div className="w-4 h-4 border-2 border-surface-container-lowest/30 border-t-surface-container-lowest rounded-full animate-spin" />
            ) : (
              <span>{isPt ? "Subscrever com Stripe" : "Subscribe with Stripe"}</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-6 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-text-primary font-medium text-xs tracking-wider uppercase border border-outline-variant transition-colors cursor-pointer"
          >
            {isPt ? "Fechar" : "Done"}
          </button>
        )}

        {/* Beta Voucher Section */}
        <div className="mt-5 pt-4 border-t border-outline-variant text-center">
          {!showVoucherInput && !isAlreadyPro ? (
            <button
              type="button"
              onClick={() => setShowVoucherInput(true)}
              className="text-xs text-text-muted hover:text-text-primary transition-colors underline underline-offset-4 cursor-pointer"
            >
              {isPt ? "Tem um voucher de clube ou código beta? Clique aqui" : "Have a club voucher or beta code? Redeem here"}
            </button>
          ) : (
            <form onSubmit={handleRedeemVoucher} className="space-y-2 mt-2">
              <p className="text-[11px] font-mono text-text-muted mb-1 font-medium">
                {isPt ? "Resgatar Voucher de Clube / Código Beta:" : "Redeem Club Voucher or Beta Code:"}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isPt ? "Ex: BETA-CLUB-60D" : "e.g. BETA-CLUB-60D"}
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="flex-1 bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-outline font-mono uppercase tracking-wider"
                  disabled={redeemingVoucher}
                  autoFocus={showVoucherInput && !isAlreadyPro}
                />
                <button
                  type="submit"
                  disabled={redeemingVoucher || !voucherCode.trim()}
                  className="bg-text-primary hover:bg-white text-surface-container-lowest disabled:opacity-50 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                >
                  {redeemingVoucher ? (
                    <div className="w-3.5 h-3.5 border-2 border-surface-container-lowest/30 border-t-surface-container-lowest rounded-full animate-spin" />
                  ) : (
                    <span>{isPt ? "Ativar" : "Redeem"}</span>
                  )}
                </button>
              </div>
              {!isAlreadyPro && (
                <button
                  type="button"
                  onClick={() => setShowVoucherInput(false)}
                  className="text-[11px] font-mono text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  {isPt ? "Cancelar" : "Cancel"}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
