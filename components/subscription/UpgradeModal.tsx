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
}

export default function UpgradeModal({ isOpen, onClose, onSuccess, isAlreadyPro = false }: UpgradeModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-[#0c1324] border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-on-surface overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Background Accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-slate-800/60 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-3">
            ⭐ {isPt ? "Plano Pro Organizador" : "Pro Organizer"}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isAlreadyPro 
              ? (isPt ? "O seu Plano Pro está Ativo" : "You Are On The Pro Plan")
              : (isPt ? "Crie e Faça a Gestão dos Seus Torneios" : "Host & Manage Your Tournaments")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm mx-auto">
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
            <div className="flex items-center justify-center gap-2 mb-6 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {isPt ? "Mensal" : "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative flex items-center justify-center gap-1.5 cursor-pointer ${
                  billingCycle === "annual"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{isPt ? "Anual" : "Annual"}</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded-full font-black border border-emerald-500/30">
                  -27%
                </span>
              </button>
            </div>

            {/* Price Tag */}
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl sm:text-5xl font-black text-white">
                  {billingCycle === "annual" ? "€34.99" : "€3.99"}
                </span>
                <span className="text-sm font-semibold text-slate-400">
                  {billingCycle === "annual" 
                    ? (isPt ? "/ ano (~€2.91/mês)" : "/ year (~€2.91/mo)") 
                    : (isPt ? "/ mês" : "/ month")}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {isPt ? "Cancele a qualquer momento. Sem compromissos." : "Cancel anytime. No lock-in."}
              </p>
            </div>
          </>
        ) : (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
            <span className="text-emerald-400 font-bold text-sm block mb-1">
              ✓ {isPt ? "Subscrição Pro Ativa" : "Active Pro Subscription"}
            </span>
            <span className="text-slate-400 text-xs">
              {isPt 
                ? "Pode criar torneios ilimitados e nomear árbitros livremente."
                : "You can create unlimited competitions and assign match officials."}
            </span>
          </div>
        )}

        {/* Feature List */}
        <div className="space-y-2.5 mb-6 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
          {[
            isPt ? "Criação ilimitada de torneios e ligas" : "Unlimited tournament creation & brackets",
            isPt ? "Fases de grupos + fases a eliminar automatizadas" : "Group stages + knockout brackets support",
            isPt ? "Atribuição e nomeação de árbitros oficiais" : "Official referee & umpire assignments",
            isPt ? "Exportação de resultados e classificações (PDF / CSV)" : "Export fixtures & standings (PDF / CSV)",
            isPt ? "Acompanhamento e notificações em tempo real" : "Real-time match tracking & instant score updates",
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5 text-xs text-slate-300">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-[10px]">
                ✓
              </div>
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
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/25 transition-all transform active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {loadingCheckout ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>{isPt ? "Subscrever com Stripe" : "Subscribe with Stripe"}</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
          >
            {isPt ? "Fechar" : "Done"}
          </button>
        )}

        {/* Beta Voucher Section */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
          {!showVoucherInput && !isAlreadyPro ? (
            <button
              type="button"
              onClick={() => setShowVoucherInput(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium underline underline-offset-4 cursor-pointer"
            >
              {isPt ? "Tem um voucher de clube ou código beta? Clique aqui" : "Have a club voucher or beta code? Redeem here"}
            </button>
          ) : (
            <form onSubmit={handleRedeemVoucher} className="space-y-2 mt-2">
              <p className="text-[11px] text-slate-400 mb-1 font-medium">
                {isPt ? "Resgatar Voucher de Clube / Código Beta:" : "Redeem Club Voucher or Beta Code:"}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isPt ? "Ex: BETA-CLUB-60D" : "e.g. BETA-CLUB-60D"}
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 uppercase tracking-wider"
                  disabled={redeemingVoucher}
                  autoFocus={showVoucherInput && !isAlreadyPro}
                />
                <button
                  type="submit"
                  disabled={redeemingVoucher || !voucherCode.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  {redeemingVoucher ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{isPt ? "Ativar" : "Redeem"}</span>
                  )}
                </button>
              </div>
              {!isAlreadyPro && (
                <button
                  type="button"
                  onClick={() => setShowVoucherInput(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-400 transition-colors cursor-pointer"
                >
                  {isPt ? "Cancelar" : "Cancel"}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Terms Link */}
        <div className="mt-4 text-center">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors underline"
          >
            {isPt ? "Termos e Condições & Política GDPR" : "Terms & Conditions & GDPR Policy"}
          </a>
        </div>
      </div>
    </div>
  );
}
