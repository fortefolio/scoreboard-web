import React from "react";

export default function SportIcon({
  sport,
  className = "text-[14px]",
}: {
  sport?: string;
  className?: string;
}) {
  const normalized = (sport || "").toLowerCase();

  if (normalized.includes("padel")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`inline-block shrink-0 ${className}`}
        style={{ width: "1.15em", height: "1.15em" }}
        aria-label="Padel"
      >
        {/* Padel racket head & handle */}
        <path d="M12 2.5C7.8 2.5 4.5 5.8 4.5 10c0 3 1.7 5.6 4.2 6.8L8.2 21.5h7.6l-.5-4.7c2.5-1.2 4.2-3.8 4.2-6.8 0-4.2-3.3-7.5-7.5-7.5z" />
        {/* Grip line */}
        <line x1="8.6" y1="18" x2="15.4" y2="18" />
        {/* Perforations / holes */}
        <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="14" r="1" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  let iconName = "sports_tennis";
  if (normalized.includes("beach volleyball") || normalized.includes("beach_volleyball") || normalized.includes("volleyball")) {
    iconName = "sports_volleyball";
  } else if (normalized.includes("football") || normalized.includes("soccer")) {
    iconName = "sports_soccer";
  } else if (normalized.includes("basketball")) {
    iconName = "sports_basketball";
  }

  return (
    <span className={`material-symbols-outlined shrink-0 ${className}`}>
      {iconName}
    </span>
  );
}
