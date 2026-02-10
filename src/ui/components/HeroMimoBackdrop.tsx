import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type PatternMotion = "none" | "drift";

function spacedToken(input: string): string {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  const stripped = raw.replace(/^@/, "").trim();
  if (!stripped) return "";

  const asciiish = /^[a-z0-9 ._/-]+$/i.test(stripped);
  if (!asciiish) return stripped;

  const normalized = stripped
    .toUpperCase()
    .replace(/[_/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  // "MIMO" -> "M I M O", "AI INFRA" -> "A I · I N F R A"
  return normalized
    .split(" ")
    .map((word) => word.split("").join(" "))
    .join("  ·  ")
    .replace(/\s+/g, " ")
    .trim();
}

function repeatCount(token: string): number {
  const len = token.length || 4;
  // Keep it simple: long tokens need fewer repeats.
  return clamp(Math.round(140 / len), 8, 18);
}

function patternFontSize(tone: "base" | "inverted", scale: number): string {
  const s = clamp(scale, 0.7, 1.4);
  if (tone === "base") {
    return `clamp(${(42 * s).toFixed(1)}px, ${(5.2 * s).toFixed(2)}vw, ${(52 * s).toFixed(1)}px)`;
  }
  return `clamp(${(26 * s).toFixed(1)}px, ${(3.4 * s).toFixed(2)}vw, ${(32 * s).toFixed(1)}px)`;
}

function PatternLayer(props: {
  token: string;
  tone: "base" | "inverted";
  opacity: number;
  scale: number;
  motion: PatternMotion;
}) {
  const rows = props.tone === "base" ? 10 : 12;
  const repeats = repeatCount(props.token);
  const motionCls =
    props.motion === "drift"
      ? props.tone === "base"
        ? "motion-safe:[animation:hb-mimo-drift_26s_ease-in-out_infinite_alternate]"
        : "motion-safe:[animation:hb-mimo-drift2_30s_ease-in-out_infinite_alternate]"
      : "";

  return (
    <div
      className={[
        "absolute inset-0 overflow-hidden select-none",
        props.tone === "base" ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden="true"
      style={{ opacity: clamp(props.opacity, 0, 1.6) }}
    >
      <div className={["absolute inset-0 flex flex-col justify-start", motionCls].join(" ")}>
        {Array.from({ length: rows }).map((_, row) => {
          const odd = row % 2 === 1;
          const cls =
            props.tone === "base"
              ? [
                  "flex whitespace-nowrap font-sans font-bold leading-[1.6] tracking-[0.30em]",
                  "text-[color:var(--hb-pat-base-ink)]",
                  odd ? "-ml-10" : "",
                ].join(" ")
              : [
                  "flex whitespace-nowrap font-sans font-bold leading-[1.6] tracking-[0.30em]",
                  "text-[color:var(--hb-pat-inv-ink)]",
                  odd ? "-ml-6" : "",
                ].join(" ");

          return (
            <div key={row} className={cls} style={{ fontSize: patternFontSize(props.tone, props.scale) }}>
              {Array.from({ length: repeats }).map((__, idx) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className={[
                    "mr-[0.6em] shrink-0 transition-[color,text-shadow] duration-300",
                    props.tone === "base"
                      ? "hover:text-[color:var(--hb-pat-base-hover)] hover:[text-shadow:0_0_28px_var(--hb-pat-base-glow)]"
                      : "",
                  ].join(" ")}
                >
                  {props.token}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HeroMimoBackdrop(props: {
  patternText: string;
  overlayOpacity?: number;
  patternOpacity?: number;
  patternScale?: number;
  patternMotion?: PatternMotion;
}) {
  const token = React.useMemo(() => spacedToken(props.patternText) || "H Y P E R B L O G", [props.patternText]);
  const overlayOpacity = clamp(props.overlayOpacity ?? 1, 0, 1);
  const patternOpacity = clamp(props.patternOpacity ?? 1, 0, 1.6);
  const patternScale = clamp(props.patternScale ?? 1, 0.7, 1.4);
  const patternMotion: PatternMotion = props.patternMotion ?? "drift";

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={
        {
          "--hb-pat-base-ink": "color-mix(in oklab, hsl(var(--fg)) 5%, transparent)",
          "--hb-pat-base-hover": "color-mix(in oklab, hsl(var(--accent)) 22%, transparent)",
          "--hb-pat-base-glow": "color-mix(in oklab, hsl(var(--accent)) 14%, transparent)",
          "--hb-pat-inv-ink": "color-mix(in oklab, hsl(var(--bg)) 12%, transparent)",
        } as React.CSSProperties
      }
    >
      <PatternLayer token={token} tone="base" opacity={patternOpacity} scale={patternScale} motion={patternMotion} />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden will-change-[clip-path]"
        style={{
          clipPath: "circle(var(--hb-spot-r, 0px) at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%))",
          opacity: overlayOpacity,
        }}
      >
        <div className="absolute inset-0 bg-[hsl(var(--fg))]" />
        <PatternLayer token={token} tone="inverted" opacity={patternOpacity * 0.95} scale={patternScale} motion={patternMotion} />
      </div>
    </div>
  );
}
