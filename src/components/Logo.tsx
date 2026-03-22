import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

// NexChat Logo — dark board frame + chalk "N" + amber lightning bolt + chalk tray
export function Logo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NexChat"
    >
      {/* Outer rounded square */}
      <rect width="96" height="96" rx="22" fill="#0d1117" />
      {/* Board frame */}
      <rect x="9" y="12" width="78" height="56" rx="7" fill="#0d1117" stroke="#30363d" strokeWidth="2" />
      {/* Board surface */}
      <rect x="11" y="14" width="74" height="52" rx="5" fill="#111820" />
      {/* Subtle horizontal lines */}
      <line x1="11" y1="32" x2="85" y2="32" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1" />
      <line x1="11" y1="48" x2="85" y2="48" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="1" />
      {/* Chalk "N" — serif, matches board aesthetic */}
      <text
        x="19" y="57"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="42"
        fontWeight="700"
        fill="white"
        opacity="0.90"
      >N</text>
      {/* Lightning bolt — amber/gold, top right */}
      <polygon points="61,17 54,33 60,33 53,49 66,30 59.5,30" fill="#f59e0b" />
      {/* Chalk tray */}
      <rect x="9" y="66" width="78" height="9" rx="4" fill="#21262d" />
      {/* Chalk pieces */}
      <rect x="52" y="68.5" width="18" height="4" rx="2" fill="#e2e8f0" opacity="0.5" />
      <rect x="36" y="69" width="10" height="3" rx="1.5" fill="#e2e8f0" opacity="0.3" />
      {/* Chalk dust */}
      <circle cx="26" cy="71" r="1.5" fill="#6b7280" opacity="0.6" />
      <circle cx="32" cy="72.5" r="1" fill="#6b7280" opacity="0.4" />
    </svg>
  );
}

export default Logo;
