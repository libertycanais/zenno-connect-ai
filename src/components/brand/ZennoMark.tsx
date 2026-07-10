// PX 1.3.1 — Zenno Enterprise Brand Mark
// Geometric monogram: open hexagon aperture + abstract Z formed by three
// diagonal circuit-like strokes and a decision node. Optically balanced for
// 16 / 32 / 64 / 128 px. No decorative gradients — signals precision.
import type { SVGProps } from "react";

type Variant = "gradient" | "mono" | "outline";

export function ZennoMark({
  variant = "gradient",
  title = "Zenno",
  className,
  ...rest
}: SVGProps<SVGSVGElement> & { variant?: Variant; title?: string }) {
  const gid = "zenno-mark-grad-v13";
  const stroke = variant === "mono" ? "currentColor" : `url(#${gid})`;
  const fill = variant === "mono" ? "currentColor" : `url(#${gid})`;

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={className} {...rest}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.16 232)" />
          <stop offset="55%" stopColor="oklch(0.70 0.19 240)" />
          <stop offset="100%" stopColor="oklch(0.58 0.24 295)" />
        </linearGradient>
      </defs>

      {/* Open hexagon aperture — 6-fold geometry, one edge broken (bottom-right)
          to signal "open system" and let the Z breathe out. */}
      <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M32 4 L56 18 L56 38" strokeOpacity={variant === "outline" ? 0.55 : 0.5} />
        <path d="M56 46 L32 60 L8 46 L8 18 L32 4" strokeOpacity={variant === "outline" ? 0.55 : 0.5} />
      </g>

      {/* Abstract Z — three parallel strokes, equal weight, mathematically spaced.
          Reads as Z at every size; reads as a decision flow up close. */}
      <g fill="none" stroke={stroke} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 22 H44" />
        <path d="M44 22 L20 42" />
        <path d="M20 42 H44" />
      </g>

      {/* Decision node — signals live intelligence. */}
      <circle cx="49.5" cy="17.5" r="2.4" fill={fill} />
    </svg>
  );
}

export function ZennoWordmark({
  className,
  showMark = true,
  tagline,
}: {
  className?: string;
  showMark?: boolean;
  tagline?: string | false;
}) {
  return (
    <span className={"inline-flex items-center gap-2.5 " + (className ?? "")}>
      {showMark && <ZennoMark className="h-6 w-6" />}
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[0.24em] zenno-gradient-text">ZENNO</span>
        {tagline !== false && (
          <span className="mt-[3px] text-[9px] uppercase tracking-[0.28em] text-muted-foreground/80">
            {tagline ?? "Enterprise Intelligence OS"}
          </span>
        )}
      </span>
    </span>
  );
}
