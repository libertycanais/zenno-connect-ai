// PX 1.1 — Dynamic Background · Cinematic ambient layer
// Additive, presentational only. Respects prefers-reduced-motion via CSS.
export function DynamicBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* base ambient gradient (reuses zenno-ambient tokens) */}
      <div className="absolute inset-0 zenno-ambient opacity-80" />
      {/* animated luminous grid */}
      <div className="absolute inset-0 zenno-grid-bg opacity-[0.35]" />
      {/* floating orbs */}
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-primary/15 blur-3xl zenno-orb" />
      <div className="absolute top-1/3 -right-40 h-[560px] w-[560px] rounded-full bg-accent/15 blur-3xl zenno-orb-slow" />
      <div className="absolute -bottom-56 left-1/3 h-[480px] w-[480px] rounded-full bg-primary/10 blur-3xl zenno-orb" style={{ animationDelay: "3.5s" }} />
      {/* scanline sweep */}
      <div className="zenno-scanline" />
      {/* subtle cinematic grain */}
      <div className="absolute inset-0 zenno-noise opacity-40" />
    </div>
  );
}
