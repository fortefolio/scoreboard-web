"use client";

import { useEffect, useRef, useState } from "react";
import { Locale } from "@/lib/i18n/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface LanguageOption {
  code: Locale;
  label: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeName: "English" },
  { code: "pt", label: "Portuguese", nativeName: "Português" },
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
        className="h-8 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-text-secondary hover:text-text-primary border border-outline-variant text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
      >
        <span className="font-semibold">{currentLanguage.code.toUpperCase()}</span>
        <span className={`material-symbols-outlined text-[14px] text-text-muted transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}>
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Available languages"
          className="absolute right-0 mt-2 w-48 bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-1.5 z-[120] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="px-2.5 py-1.5 border-b border-outline-variant mb-1 flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
              Language / Idioma
            </span>
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-surface-container-highest text-text-primary border border-outline-variant"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-container-high border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <span className="material-symbols-outlined text-[14px] text-text-primary">check</span>
                    ) : (
                      <span className="w-3.5" />
                    )}
                    <span>{lang.nativeName}</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected
                        ? "bg-surface-container text-text-primary border border-outline-variant"
                        : "bg-surface-container-low text-text-muted"
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
