"use client";

import { useState } from "react";

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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
      <div className="bg-surface-container-high rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-3xl border border-outline-variant/20 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-headline font-black mb-2 uppercase tracking-tight">Edit Match Rules</h2>
        <p className="text-on-surface-variant text-xs mb-8 font-label tracking-widest uppercase opacity-60">
          {sportType} • Round {roundNum} Configuration
        </p>

        <div className="space-y-5">
          <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
            <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
              {isFootball ? "Stadium / Venue Name" : "Court / Venue Name"}
            </label>
            <input
              type="text"
              placeholder={isBasketball ? "e.g. TD Garden" : isFootball ? "e.g. Estádio da Luz" : "e.g. Center Court"}
              className="w-full bg-transparent text-xl font-black text-indigo-400 outline-none placeholder:opacity-20"
              value={court}
              onChange={(e) => setCourt(e.target.value)}
            />
          </div>

          {/* Basketball Specific Rules */}
          {isBasketball && (
            <>
              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                  Quarter Duration (Minutes)
                </label>
                <div className="flex gap-2">
                  {[10, 12, 8].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setQuarterMinutes(mins)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                        quarterMinutes === mins
                          ? "bg-primary text-on-primary shadow-md"
                          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {mins} min {mins === 10 ? "(FIBA)" : mins === 12 ? "(NBA)" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                  Shot Clock (Seconds)
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                  value={shotClockSeconds}
                  onChange={(e) => setShotClockSeconds(parseInt(e.target.value) || 24)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                    Overtime (Min)
                  </label>
                  <input
                    type="number"
                    className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                    value={overtimeMinutes}
                    onChange={(e) => setOvertimeMinutes(parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                  <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                    Bonus at Fouls
                  </label>
                  <input
                    type="number"
                    className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                    value={foulsBonus}
                    onChange={(e) => setFoulsBonus(parseInt(e.target.value) || 5)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Football Specific Rules */}
          {isFootball && (
            <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
              <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                Half Duration (Minutes)
              </label>
              <input
                type="number"
                className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                value={halfMinutes}
                onChange={(e) => setHalfMinutes(parseInt(e.target.value) || 45)}
              />
            </div>
          )}

          {/* Volleyball & Tennis Rules */}
          {!isBasketball && !isFootball && (
            <>
              <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                  Maximum Sets
                </label>
                <input
                  type="number"
                  className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                  value={sets}
                  onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                />
              </div>

              {isPadel && (
                <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10 flex items-center justify-between">
                  <div>
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-0.5">
                      Ponto de Ouro (Golden Point)
                    </label>
                    <p className="text-[11px] text-on-surface-variant/70">
                      Sem vantagens (decisivo a 40-40)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoAd(!noAd)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      noAd
                        ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {noAd ? "Ativo" : "Inativo"}
                  </button>
                </div>
              )}

              {!isRacketSport && (
                <>
                  <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                      Points per Set
                    </label>
                    <input
                      type="number"
                      className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                      value={points}
                      onChange={(e) => setPoints(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/10">
                    <label className="block text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                      Point Cap (Optional)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-transparent text-xl font-black text-on-surface outline-none"
                      placeholder="No cap"
                      value={cap}
                      onChange={(e) => setCap(e.target.value === "" ? "" : parseInt(e.target.value))}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex gap-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 text-on-surface-variant font-bold hover:text-on-surface transition-colors uppercase tracking-widest text-[10px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-primary-container text-on-primary-container py-4 rounded-full font-black uppercase tracking-[0.2em] text-[10px] hover:brightness-110 transition-all shadow-xl shadow-primary-container/20 cursor-pointer"
            >
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
