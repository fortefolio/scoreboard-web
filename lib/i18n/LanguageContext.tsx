"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { Locale, Translations } from "./types";
import { en } from "./locales/en";
import { pt } from "./locales/pt";

const dictionaries: Record<Locale, Translations> = {
  en,
  pt,
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
  translations: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "scoreboard_locale";

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === "en" || saved === "pt")) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    } else {
      // Check browser preferences
      const browserLang = navigator.language?.toLowerCase() || "";
      if (browserLang.startsWith("pt")) {
        setLocaleState("pt");
        document.documentElement.lang = "pt";
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
  };

  const currentDict = dictionaries[locale] || en;

  const t = useMemo(() => {
    return (path: string, params?: Record<string, string | number>): string => {
      let text = getNestedValue(currentDict, path);
      if (text === undefined) {
        // Fallback to English dictionary
        text = getNestedValue(en, path);
      }
      if (text === undefined) {
        return path;
      }
      if (params) {
        Object.entries(params).forEach(([key, val]) => {
          text = (text as string).replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
        });
      }
      return text;
    };
  }, [currentDict]);

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t,
        translations: currentDict,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

const defaultT = (path: string, params?: Record<string, string | number>): string => {
  let text = getNestedValue(en, path);
  if (text === undefined) return path;
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      text = (text as string).replace(new RegExp(`\\{${key}\\}`, "g"), String(val));
    });
  }
  return text;
};

const defaultContextValue: LanguageContextType = {
  locale: "en",
  setLocale: () => {},
  t: defaultT,
  translations: en,
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context || defaultContextValue;
}

export function useTranslation() {
  const { t, locale, setLocale, translations } = useLanguage();
  return { t, locale, setLocale, translations };
}
