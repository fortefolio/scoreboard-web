import React from "react";

interface SportIconProps {
  sport?: string | null;
  className?: string;
  size?: number | string;
}

export default function SportIcon({
  sport,
  className = "text-[15px]",
  size,
}: SportIconProps) {
  const normalized = (sport || "").toLowerCase();
  const dimensionProps = size
    ? { width: size, height: size }
    : { width: "1em", height: "1em" };

  // 1. Padel: MaterialCommunityIcons "racquetball" (matches mobile)
  if (normalized.includes("padel")) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`inline-block shrink-0 ${className}`}
        {...dimensionProps}
        aria-label="Padel"
      >
        <path d="M18.5,16C19.9,16 21,17.1 21,18.5C21,19.9 19.9,21 18.5,21C17.1,21 16,19.9 16,18.5C16,17.1 17.1,16 18.5,16M10.5,1C3,1 3,3.7 3,9.8C3,13.2 6.4,16.9 9,18.1V23H12V18.1C14.6,16.9 18,13.2 18,9.8C18,3.6 18,1 10.5,1M15.4,4.2C15.7,4.6 15.8,5.2 15.9,6H15V3.8C15.2,3.9 15.3,4.1 15.4,4.2M16,9.8C16,9.9 16,10 16,10H15V7H16C16,7.8 16,8.7 16,9.8M14,14H11V11H14V14M7,14V11H10V14H7M5,9.8C5,8.8 5,7.9 5,7H6V10H5C5,9.9 5,9.8 5,9.8M7,7H10V10H7V7M11,3C12.4,3 13.4,3.2 14,3.3V6H11V3M10,6H7V3.4C7.6,3.2 8.6,3 10,3V6M11,10V7H14V10H11M6,3.8V6H5.1C5.2,5.2 5.3,4.6 5.6,4.2C5.7,4.1 5.8,4 6,3.8M5.2,11H6V12.7C5.7,12.1 5.4,11.6 5.2,11M8,15H10V16.3L9.8,16.2C9.2,16 8.6,15.5 8,15M11.2,16.3H11V15H13C12.4,15.5 11.8,16 11.2,16.3M15,12.7V11H15.8C15.6,11.5 15.3,12.1 15,12.7Z" />
      </svg>
    );
  }

  // 2. Tennis: Ionicons "tennisball" (matches mobile)
  if (normalized.includes("tennis")) {
    return (
      <svg
        viewBox="0 0 512 512"
        fill="currentColor"
        className={`inline-block shrink-0 ${className}`}
        {...dimensionProps}
        aria-label="Tennis"
      >
        <path d="M448,256a192.55,192.55,0,0,0,32-2.68A224,224,0,0,0,258.68,32,192.55,192.55,0,0,0,256,64C256,169.87,342.13,256,448,256Z" />
        <path d="M253.35,480c.94-5.67,1.65-11.4,2.09-17.18.37-4.88.56-9.86.56-14.79,0-105.87-86.13-192-192-192a192.55,192.55,0,0,0-32,2.68A224,224,0,0,0,253.35,480Z" />
        <path d="M289.61,222.39A222.53,222.53,0,0,1,224,64a226.07,226.07,0,0,1,2-30A224.1,224.1,0,0,0,34,226a226.07,226.07,0,0,1,30-2,222.53,222.53,0,0,1,158.39,65.61A222.53,222.53,0,0,1,288,448c0,5.74-.22,11.53-.65,17.22q-.5,6.42-1.36,12.79A224.12,224.12,0,0,0,478,286a226.07,226.07,0,0,1-30,2A222.53,222.53,0,0,1,289.61,222.39Z" />
      </svg>
    );
  }

  // 3. Volleyball & Beach Volleyball: MaterialCommunityIcons "volleyball" (matches mobile)
  if (
    normalized.includes("beach volleyball") ||
    normalized.includes("beach_volleyball") ||
    normalized.includes("volleyball")
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`inline-block shrink-0 ${className}`}
        {...dimensionProps}
        aria-label="Volleyball"
      >
        <path d="M19.04 4.85C17.34 3.2 15.33 2.25 13 2V5.62L22 10.8C21.72 8.5 20.73 6.5 19.04 4.85M12 22C15.44 22 18.16 20.62 20.17 17.86L17.06 16L8.07 21.2C9.32 21.73 10.64 22 12 22M13 11.41L21.15 16.07C21.59 15.13 21.88 14.14 22 13.11L13 7.93V11.41M3.88 17.81C4.54 18.72 5.26 19.46 6.05 20L15.04 14.9L12 13.15L3.88 17.81M11.04 2C10 2.09 9 2.36 8 2.8V13.15L11.04 11.41V2M2 12C2 13.39 2.3 14.77 2.89 16.12L6 14.28V4C3.33 6 2 8.65 2 12Z" />
      </svg>
    );
  }

  // 4. Football / Soccer: Ionicons "football" (matches mobile)
  if (normalized.includes("football") || normalized.includes("soccer")) {
    return (
      <svg
        viewBox="0 0 512 512"
        fill="currentColor"
        className={`inline-block shrink-0 ${className}`}
        {...dimensionProps}
        aria-label="Football"
      >
        <path d="M256,48C141.31,48,48,141.31,48,256s93.31,208,208,208,208-93.31,208-208S370.69,48,256,48ZM399,352H353.78a8,8,0,0,1-6.91-4l-16.14-27.68a8,8,0,0,1-.86-6l14.86-59.92a8,8,0,0,1,4.65-5.45l28.1-11.9a8,8,0,0,1,8.34,1.3l41.63,35.82a8,8,0,0,1,2.69,7.26,174.75,174.75,0,0,1-24.28,66.68A8,8,0,0,1,399,352ZM134.52,237.13l28.1,11.9a8,8,0,0,1,4.65,5.45l14.86,59.92a8,8,0,0,1-.86,6L165.13,348a8,8,0,0,1-6.91,4H113a8,8,0,0,1-6.82-3.81,174.75,174.75,0,0,1-24.28-66.68,8,8,0,0,1,2.69-7.26l41.63-35.82A8,8,0,0,1,134.52,237.13Zm256.94-87.24-18.07,51.38A8,8,0,0,1,369,206l-29.58,12.53a8,8,0,0,1-8.26-1.24l-56.26-47.19A8,8,0,0,1,272,164V130.42a8,8,0,0,1,3.56-6.65l42.83-28.54a8,8,0,0,1,7.66-.67A176.92,176.92,0,0,1,390,142,8,8,0,0,1,391.46,149.89ZM193.6,95.23l42.84,28.54a8,8,0,0,1,3.56,6.65V164a8,8,0,0,1-2.86,6.13l-56.26,47.19a8,8,0,0,1-8.26,1.24L143,206a8,8,0,0,1-4.43-4.72l-18.07-51.38A8,8,0,0,1,122,142a176.92,176.92,0,0,1,64-47.48A8,8,0,0,1,193.6,95.23Zm17.31,327.46L191.18,373a8,8,0,0,1,.52-7l15.17-26a8,8,0,0,1,6.91-4h84.44a8,8,0,0,1,6.91,4l15.18,26a8,8,0,0,1,.53,7l-19.59,49.67a8,8,0,0,1-5.69,4.87,176.58,176.58,0,0,1-79,0A8,8,0,0,1,210.91,422.69Z" />
      </svg>
    );
  }

  // 5. Basketball: Ionicons "basketball" (matches mobile)
  if (normalized.includes("basketball")) {
    return (
      <svg
        viewBox="0 0 512 512"
        fill="currentColor"
        className={`inline-block shrink-0 ${className}`}
        {...dimensionProps}
        aria-label="Basketball"
      >
        <path d="M256,233.37l34.45-34.45A207.08,207.08,0,0,1,240.33,63.67c0-5,.19-10.05.54-15A207.09,207.09,0,0,0,120.67,98Z" />
        <path d="M313.14,176.23,391.33,98A207.07,207.07,0,0,0,273,48.8c-.41,4.9-.64,9.86-.64,14.87A175.25,175.25,0,0,0,313.14,176.23Z" />
        <path d="M335.77,198.86a175.25,175.25,0,0,0,112.56,40.81c5,0,10-.23,14.87-.64A207.07,207.07,0,0,0,414,120.67Z" />
        <path d="M176.23,313.14A175.23,175.23,0,0,0,63.67,272.33q-7.52,0-14.87.64A207.07,207.07,0,0,0,98,391.33Z" />
        <path d="M256,278.63l-34.45,34.45a207.08,207.08,0,0,1,50.12,135.25c0,5-.19,10.05-.54,15A207.06,207.06,0,0,0,391.33,414Z" />
        <path d="M448.33,271.67a207.08,207.08,0,0,1-135.25-50.12L278.63,256,414,391.33a207.09,207.09,0,0,0,49.39-120.2C458.38,271.48,453.37,271.67,448.33,271.67Z" />
        <path d="M233.37,256,98,120.67a207.06,207.06,0,0,0-49.39,120.2c5-.35,10-.54,15-.54a207.08,207.08,0,0,1,135.25,50.12Z" />
        <path d="M120.67,414A207.07,207.07,0,0,0,239,463.2q.63-7.35.64-14.87a175.23,175.23,0,0,0-40.81-112.56Z" />
      </svg>
    );
  }

  // Fallback: Trophy (matches mobile fallback Ionicons "trophy-outline")
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      stroke="currentColor"
      strokeWidth="32"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      {...dimensionProps}
      aria-label="Sport"
    >
      <line x1="176" y1="464" x2="336" y2="464" />
      <line x1="256" y1="392" x2="256" y2="464" />
      <path d="M256,368A176,176,0,0,1,80,192V64H432V192A176,176,0,0,1,256,368Z" />
      <path d="M80,96H48a32,32,0,0,0-32,32v32c0,35.35,28.65,64,64,64H80" />
      <path d="M432,96h32a32,32,0,0,1,32,32v32c0,35.35-28.65,64-64,64H432" />
    </svg>
  );
}
