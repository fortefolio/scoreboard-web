"use client";

import { useState } from "react";
import { useTranslation, getSportTranslation } from "@/lib/i18n";

interface RuleModalProps {
  roundNum: number;
  initialRules: Record<string, any>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (setsOrRules: any, pointsOrCourt?: any, cap?: any, court?: string | null, noAd?: boolean) => void;
  sportType?: string;
  initialCourt?: string | null;
}

export default function RuleModal({
  roundNum,
  initialRules,
  isOpen,
  onClose,
  onSave,
  sportType,
  initialCourt,
}: RuleModalProps) {
  const { t } = useTranslation();
  const isBasketball = sportType === "Basketball";
  const isFootball = sportType === "Football";
  const isTennis = sportType === "Tennis";
  const isPadel = sportType === "Padel";
  const isRacketSport = isTennis || isPadel;

  // Shared
  const [court, setCourt] = useState<string>(initialCourt || "");

  // Sets-based sports (Volleyball, Tennis, Padel)
  const [sets, setSets] = useState(initialRules?.max_sets || (sportType === "Volleyball" ? 5 : 3));
  const [points, setPoints] = useState(initialRules?.points_per_set || (sportType === "Volleyball" ? 25 : isRacketSport ? 6 : 21));
  const [cap, setCap] = useState<number | "">(initialRules?.point_cap || "");
  const [noAd, setNoAd] = useState<boolean>(initialRules?.no_ad ?? true);

  // Basketball
  const [quarterMinutes, setQuarterMinutes] = useState(initialRules?.quarter_minutes || 10);
  const [shotClockSeconds, setShotClockSeconds] = useState(initialRules?.shot_clock_seconds || 24);
  const [overtimeMinutes, setOvertimeMinutes] = useState(initialRules?.overtime_minutes || 5);
  const [foulsBonus, setFoulsBonus] = useState(initialRules?.fouls_bonus || 5);

  // Football
  const [halfMinutes, setHalfMinutes] = useState(initialRules?.half_minutes || 45);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedCourt = court.trim() === "" ? null : court.trim();

    if (isBasketball) {
      const savedRules = {
        ...initialRules,
        quarter_minutes: quarterMinutes,
        quarters_count: 4,
        shot_clock_seconds: shotClockSeconds,
        overtime_minutes: overtimeMinutes,
        fouls_bonus: foulsBonus,
      };
      onSave(savedRules, trimmedCourt);
    } else if (isFootball) {
      const savedRules = {
        ...initialRules,
        half_minutes: halfMinutes,
      };
      onSave(savedRules, trimmedCourt);
    } else if (isPadel) {
      onSave(sets, 6, cap === "" ? null : cap, trimmedCourt, noAd);
    } else {
      onSave(sets, points, cap === "" ? null : cap, trimmedCourt);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-surface-container rounded-2xl p-5 sm:p-7 max-w-md w-full shadow-2xl border border-outline-variant animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg sm:text-xl font-semibold mb-1 tracking-tight text-text-primary">{t("match.editRulesTitle")}</h2>
        <p className="text-text-muted text-xs mb-6">
          {t("match.roundConfiguration", { sport: getSportTranslation(sportType, t) || "Sport", round: roundNum })}
        </p>

        <div className="space-y-4">
          <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
            <label className="block text-[11px] font-medium text-text-muted mb-1.5">
              {isFootball ? t("match.venueStadium") : t("match.venueCourt")}
            </label>
            <input
              type="text"
              placeholder={isBasketball ? "e.g. TD Garden" : isFootball ? "e.g. Estádio da Luz" : "e.g. Center Court"}
              className="w-full bg-transparent text-base font-semibold text-text-primary outline-none placeholder:text-text-muted/40"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
            />
          </div>

          {/* Basketball Specific Rules */}
          {isBasketball && (
            <>
              <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  {t("match.quarterDurationMinutes")}
                </label>
                <div className="flex gap-2">
                  {[10, 12, 8].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setQuarterMinutes(mins)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        quarterMinutes === mins
                          ? "bg-surface-container text-text-primary border border-outline-variant shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {mins} min {mins === 10 ? "(FIBA)" : mins === 12 ? "(NBA)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  {t("match.shotClock")} ({t("match.secondsCount", { count: "" }).trim()})
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                  value={shotClockSeconds}
                  onChange={(e) => setShotClockSeconds(parseInt(e.target.value) || 24)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                    {t("match.overtime")} (Min)
                  </label>
                  <input
                    type="number"
                    className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                    value={overtimeMinutes}
                    onChange={(e) => setOvertimeMinutes(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                  <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                    {t("match.bonusAtFouls")}
                  </label>
                  <input
                    type="number"
                    className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                    value={foulsBonus}
                    onChange={(e) => setFoulsBonus(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Football Specific Rules */}
          {isFootball && (
            <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
              <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                {t("match.halfDurationMinutes")}
              </label>
              <input
                type="number"
                className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                value={halfMinutes}
                onChange={(e) => setHalfMinutes(parseInt(e.target.value) || 45)}
              />
            </div>
          )}

          {/* Volleyball & Tennis Rules */}
          {!isBasketball && !isFootball && (
            <>
              <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                  {t("match.maximumSets")}
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                  value={sets}
                  onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                />
              </div>

              {isPadel && (
                <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-medium text-text-primary mb-0.5">
                      {t("match.goldenPoint")}
                    </label>
                    <p className="text-[11px] text-text-muted">
                      {t("match.goldenPointDesc")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoAd(!noAd)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border border-outline-variant ${
                      noAd
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-surface-container text-text-muted"
                    }`}
                  >
                    {noAd ? t("match.active") : t("match.inactive")}
                  </button>
                </div>
              )}

              {!isRacketSport && (
                <>
                  <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                    <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                      {t("match.pointsPerSet")}
                    </label>
                    <input
                      type="number"
                      className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                      value={points}
                      onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="p-3.5 bg-surface-container-high rounded-xl border border-outline-variant">
                    <label className="block text-[11px] font-medium text-text-muted mb-1.5">
                      {t("match.pointCapOptional")}
                    </label>
                    <input
                      type="number"
                      className="w-full bg-transparent text-base font-semibold text-text-primary outline-none"
                      placeholder={t("match.noCap")}
                      value={cap}
                      onChange={(e) => setCap(e.target.value === "" ? "" : parseInt(e.target.value))}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex gap-3 pt-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-transparent hover:bg-surface-container-high border border-outline-variant text-text-secondary rounded-lg font-medium text-xs transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-text-primary hover:bg-white text-surface-container-lowest py-2.5 px-4 rounded-lg font-medium text-xs transition-colors cursor-pointer"
            >
              {t("match.saveRules")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
