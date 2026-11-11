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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-surface-container border border-outline-variant rounded-2xl p-6 sm:p-7 shadow-2xl text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-container-high cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg leading-none">close</span>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface-container-high text-text-secondary border border-outline-variant mb-2.5">
            <span className="material-symbols-outlined text-[13px] leading-none text-text-muted">sensors</span>
            <span>OBS & vMix</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            {t("match.streamOverlayTitle")}
          </h2>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            {t("match.streamOverlayDesc")}
          </p>
        </div>

        {/* Settings: Position & Size */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              {isPt ? "Posição no Vídeo" : "Screen Position"}
            </label>
            <div className="flex bg-surface-container-low p-0.5 rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setPosition("top")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  position === "top"
                    ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {isPt ? "Topo" : "Top"}
              </button>
              <button
                type="button"
                onClick={() => setPosition("bottom")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  position === "bottom"
                    ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {isPt ? "Fundo" : "Bottom"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              {isPt ? "Escala / Tamanho" : "Size Scale"}
            </label>
            <div className="flex bg-surface-container-low p-0.5 rounded-lg border border-outline-variant">
              <button
                type="button"
                onClick={() => setScale("sm")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scale === "sm"
                    ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                SM
              </button>
              <button
                type="button"
                onClick={() => setScale("md")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scale === "md"
                    ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                MD
              </button>
              <button
                type="button"
                onClick={() => setScale("lg")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  scale === "lg"
                    ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                LG
              </button>
            </div>
          </div>
        </div>

        {/* URL Box & Copy Button */}
        <div className="mb-5">
          <label className="block text-[11px] font-medium text-text-muted mb-1.5">
            {isPt ? "URL da Fonte de Navegador (Browser Source)" : "Browser Source URL"}
          </label>
          <div className="flex items-center gap-2 bg-surface-container-low border border-outline-variant rounded-lg p-1.5 pl-3">
            <input
              type="text"
              readOnly
              value={overlayUrl}
              className="bg-transparent flex-1 text-xs text-text-secondary font-mono outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-1.5 bg-text-primary hover:bg-white text-surface-container-lowest text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <span className="material-symbols-outlined text-[15px] leading-none">check</span>
                  <span>{isPt ? "Copiado!" : "Copied!"}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px] leading-none">content_copy</span>
                  <span>{isPt ? "Copiar" : "Copy"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 mb-6 text-xs text-text-secondary space-y-2">
          <p className="font-medium text-text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-text-muted leading-none">info</span>
            <span>{isPt ? "Como configurar no OBS Studio:" : "How to set up in OBS Studio:"}</span>
          </p>
          <ol className="list-decimal pl-4 space-y-1.5 text-text-muted text-[11px] leading-relaxed">
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
            className="flex-1 py-2.5 px-4 bg-surface-container-high hover:bg-surface-container-highest text-text-primary text-center text-xs font-medium rounded-lg transition-colors cursor-pointer border border-outline-variant"
          >
            {isPt ? "Abrir Pré-visualização ↗" : "Open Live Preview ↗"}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-transparent hover:bg-surface-container-high text-text-secondary text-xs font-medium rounded-lg transition-colors cursor-pointer border border-outline-variant"
          >
            {isPt ? "Fechar" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
