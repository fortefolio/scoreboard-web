"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/LanguageContext";

interface StreamOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
}

export default function StreamOverlayModal({ isOpen, onClose, matchId }: StreamOverlayModalProps) {
  const { t, locale } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const [scale, setScale] = useState<"sm" | "md" | "lg">("md");

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const overlayUrl = `${origin}/match/${matchId}/overlay?pos=${position}&scale=${scale}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      toast.success(t("match.streamOverlayCopied"));
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error(locale === "pt" ? "Erro ao copiar URL" : "Failed to copy URL");
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
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-2">
            📺 OBS & vMix
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {t("match.streamOverlayTitle")}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5">
            {t("match.streamOverlayDesc")}
          </p>
        </div>

        {/* Settings: Position & Size */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              {isPt ? "Posição no Vídeo" : "Screen Position"}
            </label>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setPosition("top")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  position === "top" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {isPt ? "Topo" : "Top"}
              </button>
              <button
                type="button"
                onClick={() => setPosition("bottom")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  position === "bottom" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {isPt ? "Fundo" : "Bottom"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              {isPt ? "Escala / Tamanho" : "Size Scale"}
            </label>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setScale("sm")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  scale === "sm" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                SM
              </button>
              <button
                type="button"
                onClick={() => setScale("md")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  scale === "md" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                MD
              </button>
              <button
                type="button"
                onClick={() => setScale("lg")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  scale === "lg" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                LG
              </button>
            </div>
          </div>
        </div>

        {/* URL Box & Copy Button */}
        <div className="mb-5">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
            {isPt ? "URL da Fonte de Navegador (Browser Source)" : "Browser Source URL"}
          </label>
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 rounded-2xl p-2 pl-3">
            <input
              type="text"
              readOnly
              value={overlayUrl}
              className="bg-transparent flex-1 text-xs text-indigo-300 font-mono outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              {copied ? (
                <>
                  <span>✓</span>
                  <span>{isPt ? "Copiado!" : "Copied!"}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  <span>{isPt ? "Copiar" : "Copy"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 mb-6 text-xs text-slate-300 space-y-2">
          <p className="font-bold text-white flex items-center gap-1.5">
            <span>💡</span> {isPt ? "Como configurar no OBS Studio:" : "How to set up in OBS Studio:"}
          </p>
          <ol className="list-decimal pl-4 space-y-1.5 text-slate-400 text-[11px]">
            <li>{isPt ? "No OBS, clique em '+' sob 'Fontes' e adicione um 'Navegador' (Browser)." : "In OBS, click '+' under Sources and add a 'Browser' source."}</li>
            <li>{isPt ? "Cole o URL acima no campo 'URL'." : "Paste the URL above into the 'URL' field."}</li>
            <li>{isPt ? "Defina Largura: 1920 e Altura: 1080 (o fundo é 100% transparente)." : "Set Width: 1920 and Height: 1080 (the background is 100% transparent)."}</li>
            <li>{isPt ? "O resultado atualiza-se em tempo real automaticamente sem tocar no computador!" : "Scores will update in real-time as the match is scored!"}</li>
          </ol>
        </div>

        {/* Bottom Actions */}
        <div className="flex gap-3">
          <a
            href={overlayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white text-center text-xs font-bold rounded-2xl transition-all cursor-pointer border border-slate-700"
          >
            {isPt ? "Abrir Pré-visualização ↗" : "Open Live Preview ↗"}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer"
          >
            {isPt ? "Fechar" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
