"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): { date: Date | null; hour: string; minute: string } {
  if (!value) return { date: null, hour: "12", minute: "00" };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { date: null, hour: "12", minute: "00" };
  return {
    date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    hour: pad2(d.getHours()),
    minute: pad2(d.getMinutes()),
  };
}

function formatIsoLocal(date: Date, hour: string, minute: string): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${hour}:${minute}`;
}

/**
 * Custom dark-mode date & time picker matching SelectField styling.
 */
export default function DateTimeField({
  value,
  onChange,
  placeholder = "Select date & time",
  className = "",
}: DateTimeFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parseValue(value), [value]);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = parsed.date ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (parsed.date) {
      setViewMonth(new Date(parsed.date.getFullYear(), parsed.date.getMonth(), 1));
    }
  }, [parsed.date]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewMonth]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(viewMonth),
    [viewMonth]
  );

  const displayLabel = useMemo(() => {
    if (!parsed.date) return null;
    const dateStr = new Intl.DateTimeFormat(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed.date);
    return `${dateStr}, ${parsed.hour}:${parsed.minute}`;
  }, [parsed]);

  const selectDate = (day: Date) => {
    onChange(formatIsoLocal(day, parsed.hour, parsed.minute));
  };

  const updateTime = (nextHour: string, nextMinute: string) => {
    const baseDate = parsed.date ?? new Date();
    onChange(formatIsoLocal(baseDate, nextHour, nextMinute));
  };

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className={`w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border text-xs outline-none transition-colors flex items-center justify-between gap-2 cursor-pointer ${
          isOpen
            ? "border-outline-focus"
            : "border-outline-variant hover:border-outline-focus/60"
        }`}
      >
        <span className={displayLabel ? "text-text-primary font-medium" : "text-text-muted"}>
          {displayLabel || placeholder}
        </span>
        <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">
          calendar_today
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-80 bottom-full mb-1.5 z-50 rounded-xl bg-surface-container-high border border-outline-variant shadow-2xl p-3 animate-in fade-in duration-150">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-2.5">
            <button
              type="button"
              onClick={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
              }
              aria-label="Previous month"
              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <span className="text-xs font-semibold text-text-primary">{monthLabel}</span>
            <button
              type="button"
              onClick={() =>
                setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
              }
              aria-label="Next month"
              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-highest border border-outline-variant text-text-secondary hover:text-text-primary inline-flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-[10px] font-medium text-text-muted text-center py-1"
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const isSelected = parsed.date ? isSameDay(day, parsed.date) : false;
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`h-7 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-text-primary text-surface-container-lowest font-semibold"
                      : isToday
                      ? "bg-surface-container text-text-primary border border-outline-focus/60"
                      : "text-text-secondary hover:bg-surface-container-highest hover:text-text-primary"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time Row */}
          <div className="pt-2.5 border-t border-outline-variant flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-text-muted">Time</span>
              <select
                aria-label="Hour"
                value={parsed.hour}
                onChange={(e) => updateTime(e.target.value, parsed.minute)}
                className="px-2 py-1 rounded-md bg-surface-container border border-outline-variant text-xs font-mono text-text-primary outline-none [color-scheme:dark] cursor-pointer"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-xs text-text-muted font-mono">:</span>
              <select
                aria-label="Minute"
                value={parsed.minute}
                onChange={(e) => updateTime(parsed.hour, e.target.value)}
                className="px-2 py-1 rounded-md bg-surface-container border border-outline-variant text-xs font-mono text-text-primary outline-none [color-scheme:dark] cursor-pointer"
              >
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-text-primary hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 rounded-md bg-text-primary text-surface-container-lowest text-[11px] font-semibold hover:bg-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
