import { cn } from "@/lib/cn";

/** The friendly assistant shown when no conversation is open. Original artwork; floats gently unless motion is reduced. */
export function RobotIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 270" className={cn("h-auto w-[200px]", className)} role="img" aria-label="مساعد Flowpal">
      <defs>
        <linearGradient id="rb-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d7dce4" />
        </linearGradient>
        <linearGradient id="rb-shell-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c9cfd9" />
          <stop offset="0.5" stopColor="#eef1f5" />
          <stop offset="1" stopColor="#c3c9d4" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24384a" />
          <stop offset="1" stopColor="#0c1620" />
        </linearGradient>
        <radialGradient id="rb-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5eead4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="120" cy="256" rx="46" ry="6" fill="#101828" opacity="0.1" className="motion-safe:animate-[robot-shadow_4s_ease-in-out_infinite]" />

      <g className="motion-safe:animate-[robot-float_4s_ease-in-out_infinite]">
        {/* arms */}
        <rect x="38" y="150" width="30" height="74" rx="15" fill="url(#rb-shell-side)" transform="rotate(12 53 160)" />
        <rect x="172" y="150" width="30" height="74" rx="15" fill="url(#rb-shell-side)" transform="rotate(-12 187 160)" />

        {/* body */}
        <path d="M120 140c34 0 56 26 56 58 0 30-24 48-56 48s-56-18-56-48c0-32 22-58 56-58z" fill="url(#rb-shell)" />
        <path d="M78 196c12 10 26 14 42 14s30-4 42-14" fill="none" stroke="#c4cad4" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="104" y="132" width="32" height="14" rx="6" fill="#c9cfd9" />

        {/* head */}
        <rect x="26" y="78" width="22" height="46" rx="11" fill="url(#rb-shell-side)" />
        <rect x="192" y="78" width="22" height="46" rx="11" fill="url(#rb-shell-side)" />
        <rect x="40" y="34" width="160" height="114" rx="46" fill="url(#rb-shell)" />
        <path d="M86 38c10-8 22-12 34-12s24 4 34 12" fill="none" stroke="#d3d8e0" strokeWidth="6" strokeLinecap="round" />

        {/* visor + face */}
        <rect x="58" y="58" width="124" height="76" rx="32" fill="url(#rb-visor)" />
        <path d="M74 70c14-6 30-8 46-8" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="94" cy="94" r="22" fill="url(#rb-glow)" />
        <circle cx="146" cy="94" r="22" fill="url(#rb-glow)" />
        <path d="M84 98a10 10 0 0 1 20 0z" fill="#5eead4" />
        <path d="M136 98a10 10 0 0 1 20 0z" fill="#5eead4" />
        <path d="M112 112q8 7 16 0" fill="none" stroke="#5eead4" strokeWidth="4.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
