"use client";

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  label?: string;
  variant?: "field" | "inline";
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Custom dark-mode dropdown select matching form input and toolbar filter styling on all screen sizes.
 */
export default function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  label,
  variant = "field",
  required = false,
  disabled = false,
  className = "",
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
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

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {required && (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {variant === "inline" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label || placeholder}
          className="flex flex-col text-left pr-1 cursor-pointer select-none focus:outline-none disabled:cursor-not-allowed"
        >
          {label && (
            <span className="text-[10px] font-medium text-text-muted leading-tight">
              {label}:
            </span>
          )}
          <span className="text-xs font-semibold text-text-primary flex items-center gap-1 leading-tight whitespace-nowrap">
            <span>{selectedOption ? selectedOption.label : placeholder}</span>
            <span
              className={`material-symbols-outlined text-[14px] text-text-muted transition-transform duration-150 ${
                isOpen ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`w-full px-3.5 py-2.5 bg-surface-container-high rounded-lg border text-sm font-medium transition-colors flex items-center justify-between gap-2 text-left focus:outline-none disabled:cursor-not-allowed ${
            isOpen ? "border-outline-focus" : "border-outline-variant focus:border-outline-focus"
          } ${selectedOption ? "text-text-primary" : "text-text-muted"}`}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <span
            className={`material-symbols-outlined text-[18px] text-text-muted shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </button>
      )}

      {isOpen && !disabled && (
        <div
          role="listbox"
          className={`absolute left-0 bg-surface-container border border-outline-variant rounded-xl shadow-2xl p-1.5 z-[120] max-h-60 overflow-y-auto ${
            variant === "inline" ? "mt-2 min-w-[170px] w-max" : "right-0 mt-1.5"
          }`}
        >
          {normalizedOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No options available</div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    variant === "inline" ? "text-xs" : "text-sm"
                  } ${
                    isSelected
                      ? "bg-surface-container-high text-text-primary font-medium"
                      : "text-text-secondary hover:bg-surface-container-high/60 hover:text-text-primary"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && (
                    <span className="material-symbols-outlined text-[16px] text-text-primary shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
