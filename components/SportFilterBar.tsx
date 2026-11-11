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
      className={`w-full overflow-x-auto no-scrollbar scroll-smooth flex items-center gap-1.5 py-1 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {SPORTS.map((s) => {
        const isSelected = selectedSport.toLowerCase() === s.key.toLowerCase();
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelectSport(s.key)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer border ${
              isSelected
                ? "bg-surface-container-highest text-text-primary border-outline shadow-sm"
                : "bg-surface-container text-text-secondary border-outline-variant hover:text-text-primary hover:bg-surface-container-high/60"
            }`}
          >
            {s.sportType && (
              <SportIcon
                sport={s.sportType}
                className={`text-[13px] ${isSelected ? "text-primary" : "text-text-muted"}`}
              />
            )}
            <span>{t(s.labelKey) || s.key}</span>
          </button>
        );
      })}
    </div>
  );
}
