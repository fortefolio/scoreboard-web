"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function LanguageSelector() {
  const { locale, setLocale } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language selector"
      className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 text-[11px] font-black tracking-wider uppercase transition-all duration-200 hover:border-slate-700 shadow-inner"
    >
      <span className="material-symbols-outlined text-slate-400 text-sm ml-1.5 mr-0.5 select-none" aria-hidden="true">
        language
      </span>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        aria-label="English"
        className={`px-2 py-1 rounded-lg transition-all duration-200 ${
          locale === "en"
            ? "bg-indigo-600 text-white shadow-sm font-black"
            : "text-slate-400 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("pt")}
        aria-pressed={locale === "pt"}
        aria-label="Português"
        className={`px-2 py-1 rounded-lg transition-all duration-200 ${
          locale === "pt"
            ? "bg-indigo-600 text-white shadow-sm font-black"
            : "text-slate-400 hover:text-white"
        }`}
      >
        PT
      </button>
    </div>
  );
}
