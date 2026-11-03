"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function TermsPage() {
  const { locale } = useTranslation();
  const [selectedLang, setSelectedLang] = useState<"en" | "pt">(locale === "pt" ? "pt" : "en");

  const isPt = selectedLang === "pt";

  return (
    <div className="min-h-screen bg-[#0c1324] text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation / Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-slate-800">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
          >
            ← {isPt ? "Voltar ao ScoreBoard" : "Back to ScoreBoard"}
          </Link>

          {/* Language Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setSelectedLang("en")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedLang === "en" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setSelectedLang("pt")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                selectedLang === "pt" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              PT
            </button>
          </div>
        </div>

        {/* Title & Meta */}
        <div className="mb-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
            ⚖️ {isPt ? "Termos Oficiais de Serviço & Privacidade" : "Official Terms of Service & Privacy"}
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            {isPt ? "Termos & Condições de Utilização" : "Terms & Conditions of Service"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-3">
            {isPt 
              ? "Última atualização: 3 de Novembro de 2026 • Em conformidade com o RGPD (UE 2016/679) e Diretrizes das Lojas de Aplicações."
              : "Last updated: November 3, 2026 • Fully compliant with EU GDPR (2016/679) and App Store Guidelines."}
          </p>
        </div>

        {/* Legal Body */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-10 space-y-10 text-sm leading-relaxed text-slate-300">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">1.</span> {isPt ? "Introdução e Aceitação" : "Introduction & Acceptance of Terms"}
            </h2>
            <p>
              {isPt
                ? "Bem-vindo ao ScoreBoard. Ao aceder, registar uma conta ou utilizar a nossa plataforma web ou aplicações móveis, concorda expressamente em ficar vinculado a estes Termos e Condições, incluindo as nossas políticas de subscrição e de proteção de dados (RGPD). Caso discorde de qualquer termo, deverá cessar a utilização e eliminar a sua conta através da área de definições."
                : "Welcome to ScoreBoard. By accessing, registering an account, or using our web platform or mobile applications, you agree to be bound by these Terms & Conditions, including our Subscription Policies and Data Retention/GDPR commitments. If you do not agree to these terms, you must discontinue using the service and delete your account via the settings dashboard."}
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">2.</span> {isPt ? "Planos e Funcionalidades do Serviço" : "Services & Plans"}
            </h2>
            <p className="mb-3">
              {isPt
                ? "O ScoreBoard disponibiliza gestão e acompanhamento de jogos e competições em tempo real para diversas modalidades desportivas (Ténis, Padel, Voleibol, Voleibol de Praia, Basquetebol e Futebol):"
                : "ScoreBoard provides live match scorekeeping, tournament bracket management, referee delegation, and real-time feeds across multiple sports (Tennis, Padel, Volleyball, Beach Volleyball, Basketball, and Football):"}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-slate-300">
              <li>
                <strong>{isPt ? "Plano Gratuito (Comunidade):" : "Community / Free Plan:"}</strong>{" "}
                {isPt
                  ? "Marcador e acompanhamento ilimitado de partidas amigáveis e individuais, acesso aos marcadores ao vivo com temas visuais de campo, participação como jogador/equipa em torneios e modo offline com sincronização automática."
                  : "Unlimited scorekeeping for friendly and standalone matches, live atmospheric court views, participating in competitions as a player/team, and offline scorekeeping with auto-sync."}
              </li>
              <li>
                <strong>{isPt ? "Plano Pro Organizador:" : "Pro Organizer Plan:"}</strong>{" "}
                {isPt
                  ? "Criação ilimitada de torneios (fase de grupos, eliminatórias simples e duplas), atribuição oficial de árbitros, personalização de patrocinadores e logótipos, exportação de resultados em PDF/CSV e marcador limpo para transmissões em direto (OBS / vMix)."
                  : "Unlimited tournament creation (Group stages, single/double knockout brackets), referee delegation, sponsor branding, PDF/CSV standings exports, and clean broadcast overlays for live streaming."}
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">3.</span> {isPt ? "Subscrições, Faturação e Vouchers de Clube" : "Subscriptions, Billing & Club Vouchers"}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Preçário e Renovação Automática" : "Pricing & Auto-Renewal"}</h3>
                <p>
                  {isPt
                    ? "O Plano Pro Organizador tem o valor de €3.99/mês (faturação mensal) ou €34.99/ano (faturação anual, poupança de ~27%). As subscrições renovam-se automaticamente a menos que sejam canceladas com pelo menos 24 horas de antecedência em relação ao fim do ciclo corrente."
                    : "The Pro Organizer Plan is priced at €3.99/month (monthly billing) or €34.99/year (annual billing, ~27% savings). Subscriptions automatically renew at the end of each billing cycle unless canceled at least 24 hours prior to the renewal date."}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Processamento de Pagamento" : "Payment Processors & App Stores"}</h3>
                <p>
                  {isPt
                    ? "Os pagamentos na web são processados de forma encriptada através do Stripe, Inc. Nas aplicações móveis (iOS e Android), as compras são processadas através da Apple StoreKit ou Google Play Billing de acordo com os termos de cada plataforma. A ativação numa plataforma desbloqueia o acesso Pro em todos os dispositivos associados à mesma conta."
                    : "Web subscriptions are securely processed by Stripe, Inc. On mobile devices (iOS & Android), purchases are billed through Apple StoreKit or Google Play Billing in compliance with store policies. An active subscription on one platform unlocks Pro features across all devices under the same account."}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Cancelamento e Política de Reembolso" : "Cancellation & Refund Policy"}</h3>
                <p>
                  {isPt
                    ? "Pode cancelar a sua subscrição a qualquer momento no menu de Definições através do Portal de Clientes Stripe ou nas definições de subscrição do seu dispositivo móvel. Ao cancelar, mantém o acesso total até ao termo do período faturado. Exceto nos termos previstos pelo direito de livre resolução da União Europeia (14 dias prévios ao início da fruição do serviço digital), os pagamentos efetuados não são reembolsáveis."
                    : "You may cancel your subscription at any time via the user Settings Customer Portal or your mobile device subscription manager. Upon cancellation, you retain full access until the end of the current paid period. Except where mandated by EU statutory consumer rights, subscription payments are non-refundable."}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Vouchers e Códigos Promocionais de Clube" : "Club Beta Vouchers & Promotional Codes"}</h3>
                <p>
                  {isPt
                    ? "Os vouchers distribuídos a clubes e parceiros durante a fase beta (ex: BETA-CLUB-60D) garantem acesso Pro temporário sem necessidade de introduzir dados de cartão de crédito. Os vouchers não têm valor monetário, não podem ser vendidos e cessam no termo do período concedido."
                    : "Promotional vouchers and beta passes distributed to clubs (e.g. BETA-CLUB-60D) grant temporary Pro access with zero credit card required. Vouchers possess no cash value, are non-transferable, and expire automatically at the end of their granted duration."}
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400">4.</span> {isPt ? "Privacidade, Retenção de Dados e RGPD (UE 2016/679)" : "Privacy, Data Retention & GDPR (EU 2016/679)"}
            </h2>
            <div className="space-y-4">
              <p>
                {isPt
                  ? "O ScoreBoard atua como Responsável pelo Tratamento de Dados (Data Controller) e respeita integralmente os princípios da privacidade desde a conceção (Privacy by Design) e por defeito."
                  : "ScoreBoard acts as Data Controller and adheres to the principles of privacy by design and by default under European Union Regulation 2016/679."}
              </p>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Dados Recolhidos e Finalidade" : "Collected Data & Purpose"}</h3>
                <p>
                  {isPt
                    ? "Recolhemos o email de registo, identificador de utilizador (username e display name), histórico de pontuações de partidas, preferências de visualização e identificadores anónimos de subscrição. Não armazenamos números de cartões de pagamento nos nossos servidores."
                    : "We collect registration email, unique handles, public display names, match scoring events, viewing preferences, and non-sensitive payment provider IDs. We never store credit card numbers on our servers."}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Direito ao Esquecimento / Eliminação Permanente (Art. 17 RGPD)" : "Right to Erasure / Account Deletion (Art. 17 GDPR)"}</h3>
                <p>
                  {isPt
                    ? "Qualquer utilizador pode eliminar a sua conta e todos os dados associados a qualquer momento, de forma autónoma, acedendo a Definições → Zona de Perigo e confirmando a ação com o texto 'DELETE'. Esta ação efetua a eliminação irreversível e criptográfica do perfil, credenciais de acesso e notificações do utilizador."
                    : "Users may permanently delete their account and associated data at any time via Settings → Danger Zone by confirming with 'DELETE'. This immediately executes an irreversible cryptographic wipe of user profile, credentials, and notifications."}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-white mb-1">{isPt ? "Portabilidade de Dados (Art. 20 RGPD)" : "Data Portability (Art. 20 GDPR)"}</h3>
                <p>
                  {isPt
                    ? "Disponibilizamos uma ferramenta de exportação completa dos seus dados no menu Definições → Segurança, gerando um ficheiro estruturado em formato JSON com todos os registos do utilizador."
                    : "We provide an automated self-service data portability export under Settings → Security & Credentials, generating a structured JSON file containing all user records."}
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">5.</span> {isPt ? "Conduta, Fair Play e Integridade Desportiva" : "Conduct, Fair Play & Sports Integrity"}
            </h2>
            <p>
              {isPt
                ? "Os utilizadores e árbitros comprometem-se a registar os resultados e ocorrências das partidas de forma fidedigna. É expressamente proibida a manipulação fraudulenta de resultados, a adulteração de escalões ou a usurpação de identidade de clubes ou federações desportivas."
                : "Users and match officials agree to record scores, fouls, and match incidents in good faith. Fraudulent tampering with match outcomes, deliberate tournament bracket manipulation, and impersonation of sporting clubs or federations are strictly prohibited."}
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-indigo-400">6.</span> {isPt ? "Lei Aplicável e Contacto" : "Governing Law & Contact"}
            </h2>
            <p className="mb-2">
              {isPt
                ? "Estes Termos regem-se pelas leis de Portugal e da União Europeia. Para quaisquer questões, suporte ou exercício de direitos de proteção de dados, contacte-nos:"
                : "These Terms are governed by and construed in accordance with the laws of Portugal and the European Union. For support or privacy inquiries, contact us at:"}
            </p>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono">
              <p>Email: <span className="text-indigo-400">support@scoreboard.app</span></p>
              <p>Privacy & Data Protection: <span className="text-indigo-400">privacy@scoreboard.app</span></p>
            </div>
          </section>
        </div>

        {/* Footer Back */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            © 2026 ScoreBoard. {isPt ? "Todos os direitos reservados." : "All rights reserved."}
          </Link>
        </div>
      </div>
    </div>
  );
}
