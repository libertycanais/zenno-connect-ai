// PX 1.2 — Zenno Brand Mark
// Enterprise monogram. Additive, presentational only. Uses currentColor + brand gradient.
import type { SVGProps } from "react";

type Variant = "gradient" | "mono" | "outline";

export function ZennoMark({
  variant = "gradient",
  title = "Zenno",
  className,
  ...rest
}: SVGProps<SVGSVGElement> & { variant?: Variant; title?: string }) {
  const gradId = "zenno-mark-grad";
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 232)" />
          <stop offset="55%" stopColor="oklch(0.72 0.18 235)" />
          <stop offset="100%" stopColor="oklch(0.58 0.24 295)" />
        </linearGradient>
      </defs>

      {/* Aperture ring — signals precision & focus */}
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke={variant === "outline" ? "currentColor" : `url(#${gradId})`}
        strokeOpacity={variant === "outline" ? 0.45 : 0.35}
        strokeWidth="1.5"
      />

      {/* Z monogram — three geometric strokes with rounded terminals */}
      <g
        fill="none"
        stroke={variant === "mono" ? "currentColor" : `url(#${gradId})`}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 20 H46" />
        <path d="M46 20 L18 44" />
        <path d="M18 44 H46" />
      </g>

      {/* Signal dot — active intelligence */}
      <circle cx="49" cy="17" r="3" fill={variant === "mono" ? "currentColor" : `url(#${gradId})`} />
    </svg>
  );
}

export function ZennoWordmark({
  className,
  showMark = true,
}: {
  className?: string;
  showMark?: boolean;
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + (className ?? "")}>
      {showMark && <ZennoMark className="h-6 w-6" />}
      <span className="text-[15px] font-semibold tracking-[0.22em] zenno-gradient-text">
        ZENNO
      </span>
    </span>
  );
}
