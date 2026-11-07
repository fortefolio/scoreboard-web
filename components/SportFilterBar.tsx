"use client";

import SportIcon from "@/components/SportIcon";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

export interface SportOption {
  key: string;
  labelKey: string;
  sportType?: string;
}

const SPORTS: SportOption[] = [
  { key: "all", labelKey: "sports.all" },
  { key: "Tennis", labelKey: "sports.tennis", sportType: "Tennis" },
  { key: "Padel", labelKey: "sports.padel", sportType: "Padel" },
  { key: "Volleyball", labelKey: "sports.volleyball", sportType: "Volleyball" },
  { key: "Beach Volleyball", labelKey: "sports.beachVolleyball", sportType: "Beach Volleyball" },
  { key: "Football", labelKey: "sports.football", sportType: "Football" },
  { key: "Basketball", labelKey: "sports.basketball", sportType: "Basketball" },
];

interface SportFilterBarProps {
  selectedSport: string;
  onSelectSport: (sport: string) => void;
  className?: string;
}

export default function SportFilterBar({
  selectedSport,
  onSelectSport,
  className = "",
}: SportFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-2 py-1 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {SPORTS.map((s) => {
        const isSelected = selectedSport.toLowerCase() === s.key.toLowerCase();
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelectSport(s.key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
              isSelected
                ? "bg-primary-container text-on-primary-container border-primary/40 shadow-sm shadow-primary/20"
                : "bg-surface-container-low text-on-surface-variant/70 border-white/5 hover:border-white/15 hover:text-on-surface"
            }`}
          >
            {s.sportType && (
              <SportIcon
                sport={s.sportType}
                className={`text-[13px] ${isSelected ? "text-primary" : "text-on-surface-variant/70"}`}
              />
            )}
            <span>{t(s.labelKey) || s.key}</span>
          </button>
        );
      })}
    </div>
  );
}
