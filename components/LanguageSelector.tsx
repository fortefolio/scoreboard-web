"use client";

import { useEffect, useRef, useState } from "react";
import { Locale } from "@/lib/i18n/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "pt", label: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
];

export default function LanguageSelector() {
  const { locale, setLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === locale) ||
    SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectLanguage = (code: Locale) => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Select language (current: ${currentLanguage.label})`}
        className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800/90 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        <span
          className="material-symbols-outlined text-slate-400 text-[18px] select-none"
          aria-hidden="true"
        >
          language
        </span>
        <span className="font-black text-[11px] tracking-wider uppercase">
          {currentLanguage.code.toUpperCase()}
        </span>
        <span
          className={`material-symbols-outlined text-slate-400 text-sm transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available languages"
          className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-1.5 z-[120] animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl"
        >
          <div className="px-2.5 py-1.5 border-b border-slate-800/60 mb-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Language / Idioma
            </p>
          </div>

          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-black shadow-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none select-none" aria-hidden="true">
                      {lang.flag}
                    </span>
                    <span>{lang.nativeName}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-black uppercase px-1.5 py-0.5 rounded-md ${
                      isSelected
                        ? "bg-indigo-500/30 text-indigo-200"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {lang.code.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
