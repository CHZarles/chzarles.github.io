import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

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

function PatternLayer(props: { token: string; tone: "base" | "inverted" }) {
  const rows = props.tone === "base" ? 10 : 12;
  const repeats = repeatCount(props.token);

  return (
    <div
      className={[
        "absolute inset-0 overflow-hidden select-none",
        props.tone === "base" ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden="true"
    >
      <div className="absolute inset-0 flex flex-col justify-start">
        {Array.from({ length: rows }).map((_, row) => {
          const odd = row % 2 === 1;
          const cls =
            props.tone === "base"
              ? [
                  "flex whitespace-nowrap font-mono font-semibold leading-[1.6]",
                  "text-[42px] md:text-[52px] tracking-[0.32em]",
                  "text-[color-mix(in_oklab,hsl(var(--fg))_7%,transparent)]",
                  odd ? "-ml-10" : "",
                ].join(" ")
              : [
                  "flex whitespace-nowrap font-mono font-semibold leading-[1.6]",
                  "text-[28px] md:text-[34px] tracking-[0.32em]",
                  "text-[color-mix(in_oklab,hsl(var(--bg))_16%,transparent)]",
                  odd ? "-ml-6" : "",
                ].join(" ");

          return (
            <div key={row} className={cls}>
              {Array.from({ length: repeats }).map((__, idx) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className={[
                    "mr-[0.6em] shrink-0 transition-[color,text-shadow] duration-300",
                    props.tone === "base"
                      ? "hover:text-[color-mix(in_oklab,hsl(var(--fg))_14%,transparent)] hover:[text-shadow:0_0_28px_color-mix(in_oklab,hsl(var(--fg))_10%,transparent)]"
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

export function HeroMimoBackdrop(props: { patternText: string; overlayOpacity?: number }) {
  const token = React.useMemo(() => spacedToken(props.patternText) || "H Y P E R B L O G", [props.patternText]);
  const overlayOpacity = clamp(props.overlayOpacity ?? 1, 0, 1);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <PatternLayer token={token} tone="base" />

      <div
        className="absolute inset-0 overflow-hidden will-change-[clip-path]"
        style={{
          clipPath: "circle(var(--hb-spot-r, 0px) at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%))",
          opacity: overlayOpacity,
        }}
      >
        <div className="absolute inset-0 bg-[hsl(var(--fg))]" />
        <PatternLayer token={token} tone="inverted" />
      </div>
    </div>
  );
}

