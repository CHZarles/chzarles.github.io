import React from "react";
import { supportsSealGlyphs } from "./HeroTitleVisual";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type PatternMotion = "none" | "drift";
type PatternVariant = "text" | "seal" | "clerical" | "essay";

const HERO_ESSAY_TEXT =
  "朝发轫于苍梧兮夕余至乎县圃欲少留此灵琐兮日忽忽其将暮吾令羲和弭节兮望崦嵫而勿迫路漫漫其修远兮吾将上下而求索饮余马于咸池兮总余辔乎扶桑折若木以拂日兮聊逍遥以相羊前望舒使先驱兮后飞廉使奔属";

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

function clericalPatternFontSize(tone: "base" | "inverted", scale: number): string {
  const s = clamp(scale, 0.7, 1.4);
  if (tone === "base") {
    return `clamp(${(28 * s).toFixed(1)}px, ${(3.2 * s).toFixed(2)}vw, ${(36 * s).toFixed(1)}px)`;
  }
  return `clamp(${(22 * s).toFixed(1)}px, ${(2.4 * s).toFixed(2)}vw, ${(28 * s).toFixed(1)}px)`;
}

function patternChars(token: string): string[] {
  return Array.from(token.replace(/\s+/g, "").trim());
}

function chunkChars(chars: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < chars.length; i += chunkSize) {
    chunks.push(chars.slice(i, i + chunkSize));
  }
  return chunks;
}

function TextPatternLayer(props: {
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
          const colorCls = props.tone === "base" ? "text-[color:var(--hb-pat-base-ink)]" : "text-[color:var(--hb-pat-inv-ink)]";
          const cls = [
            "flex whitespace-nowrap font-sans font-bold leading-[1.6] tracking-[0.30em]",
            colorCls,
            odd ? (props.tone === "base" ? "-ml-10" : "-ml-6") : "",
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

function SealPatternLayer(props: {
  tone: "base" | "inverted";
  opacity: number;
  scale: number;
  motion: PatternMotion;
}) {
  const motionCls =
    props.motion === "drift"
      ? props.tone === "base"
        ? "motion-safe:[animation:hb-mimo-drift_26s_ease-in-out_infinite_alternate]"
        : "motion-safe:[animation:hb-mimo-drift2_30s_ease-in-out_infinite_alternate]"
      : "";
  const heightPx = clamp((props.tone === "base" ? 34 : 24) * props.scale, props.tone === "base" ? 24 : 18, props.tone === "base" ? 42 : 30);
  const widthPx = Math.round(heightPx * 4.9);
  const offsetX = Math.round(widthPx * 0.5);
  const offsetY = Math.round(heightPx * 0.38);

  return (
    <div
      className={["pointer-events-none absolute inset-[-6%] select-none overflow-hidden", motionCls].join(" ")}
      aria-hidden="true"
      style={{ opacity: clamp(props.opacity, 0, 1.6) }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: props.tone === "base" ? "var(--hb-pat-base-ink)" : "var(--hb-pat-inv-ink)",
          WebkitMaskImage: 'url("/hero-title/chaohuaxishi-seal-tile.svg")',
          maskImage: 'url("/hero-title/chaohuaxishi-seal-tile.svg")',
          WebkitMaskRepeat: "repeat",
          maskRepeat: "repeat",
          WebkitMaskSize: `${widthPx}px ${heightPx}px`,
          maskSize: `${widthPx}px ${heightPx}px`,
          WebkitMaskPosition: props.tone === "base" ? "0 0" : `${-offsetX}px ${-offsetY}px`,
          maskPosition: props.tone === "base" ? "0 0" : `${-offsetX}px ${-offsetY}px`,
          willChange: props.motion === "drift" ? "transform" : undefined,
        }}
      />
    </div>
  );
}

function ClericalPatternLayer(props: {
  token: string;
  tone: "base" | "inverted";
  opacity: number;
  scale: number;
  motion: PatternMotion;
}) {
  const chars = patternChars(props.token);
  const rows = props.tone === "base" ? 9 : 11;
  const repeats = clamp(Math.round(88 / Math.max(chars.length, 4)), 7, 12);
  const motionCls =
    props.motion === "drift"
      ? props.tone === "base"
        ? "motion-safe:[animation:hb-mimo-drift_26s_ease-in-out_infinite_alternate]"
        : "motion-safe:[animation:hb-mimo-drift2_30s_ease-in-out_infinite_alternate]"
      : "";

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
      style={{ opacity: clamp(props.opacity, 0, 1.6) }}
    >
      <div className={["absolute inset-[-3%] flex flex-col justify-start", motionCls].join(" ")}>
        {Array.from({ length: rows }).map((_, row) => {
          const odd = row % 2 === 1;
          return (
            <div
              key={row}
              className={[
                "flex whitespace-nowrap leading-none",
                props.tone === "base" ? "text-[color:var(--hb-pat-base-ink)]" : "text-[color:var(--hb-pat-inv-ink)]",
                odd ? (props.tone === "base" ? "-ml-[6.4em]" : "-ml-[5.1em]") : "",
              ].join(" ")}
              style={{ fontSize: clericalPatternFontSize(props.tone, props.scale) }}
            >
              {Array.from({ length: repeats }).map((__, idx) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className="hero-clerical-pattern mr-[2.45em] inline-flex items-end gap-[1.15em]"
                >
                  {chars.map((char, charIndex) => (
                    <span key={`${char}-${charIndex}`} className="hero-clerical-char">
                      {char}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EssayPatternLayer(props: {
  tone: "base" | "inverted";
  opacity: number;
  scale: number;
  motion: PatternMotion;
}) {
  const motionCls =
    props.motion === "drift"
      ? props.tone === "base"
        ? "motion-safe:[animation:hb-mimo-drift_26s_ease-in-out_infinite_alternate]"
        : "motion-safe:[animation:hb-mimo-drift2_30s_ease-in-out_infinite_alternate]"
      : "";
  const columnLength = props.tone === "base" ? 9 : 8;
  const chars = React.useMemo(() => Array.from(`${HERO_ESSAY_TEXT}${HERO_ESSAY_TEXT}${HERO_ESSAY_TEXT}`), []);
  const columns = React.useMemo(() => chunkChars(chars, columnLength), [chars, columnLength]);
  const fontSize = clamp((props.tone === "base" ? 22 : 18) * props.scale, props.tone === "base" ? 16 : 14, props.tone === "base" ? 28 : 22);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
      style={{ opacity: clamp(props.opacity, 0, 1.6) }}
    >
      <div
        className={["absolute inset-[-3%] flex flex-row-reverse items-start", motionCls].join(" ")}
        style={{ gap: props.tone === "base" ? `${1.55 * props.scale}rem` : `${1.25 * props.scale}rem` }}
      >
        {columns.map((column, columnIndex) => (
          <div
            key={`${props.tone}-${columnIndex}`}
            className={[
              "hero-essay-pattern flex flex-col items-center",
              props.tone === "base" ? "text-[color:var(--hb-pat-base-ink)]" : "text-[color:var(--hb-pat-inv-ink)]",
            ].join(" ")}
            style={{
              fontSize: `${fontSize}px`,
              gap: props.tone === "base" ? `${0.32 * props.scale}rem` : `${0.24 * props.scale}rem`,
            }}
          >
            {column.map((char, charIndex) => (
              <span key={`${columnIndex}-${charIndex}`}>{char}</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroMimoBackdrop(props: {
  patternText: string;
  patternStyle?: PatternVariant;
  overlayOpacity?: number;
  patternOpacity?: number;
  patternScale?: number;
  patternMotion?: PatternMotion;
  spotlightSceneUrl?: string;
  spotlightScenePosition?: string;
  spotlightSceneOpacity?: number;
  spotlightSceneScale?: number;
}) {
  const token = React.useMemo(() => spacedToken(props.patternText) || "H Y P E R B L O G", [props.patternText]);
  const patternStyle: PatternVariant =
    props.patternStyle === "seal"
      ? supportsSealGlyphs(token)
        ? "seal"
        : "text"
      : props.patternStyle === "clerical"
        ? "clerical"
        : props.patternStyle === "essay"
          ? "essay"
        : "text";
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
          background:
            "linear-gradient(180deg, color-mix(in oklab, hsl(var(--bg)) 98%, white) 0%, color-mix(in oklab, hsl(var(--bg)) 96%, hsl(var(--card))) 56%, color-mix(in oklab, hsl(var(--bg)) 95%, hsl(var(--card2))) 100%)",
          "--hb-pat-base-ink":
            patternStyle === "essay"
              ? "color-mix(in oklab, hsl(var(--fg)) 14%, transparent)"
              : patternStyle === "clerical"
              ? "color-mix(in oklab, hsl(var(--fg)) 11%, transparent)"
              : "color-mix(in oklab, hsl(var(--fg)) 5%, transparent)",
          "--hb-pat-base-hover": "color-mix(in oklab, hsl(var(--accent)) 22%, transparent)",
          "--hb-pat-base-glow": "color-mix(in oklab, hsl(var(--accent)) 14%, transparent)",
          "--hb-pat-inv-ink":
            patternStyle === "essay"
              ? "color-mix(in oklab, hsl(var(--fg)) 22%, transparent)"
              : patternStyle === "clerical"
              ? "color-mix(in oklab, hsl(var(--fg)) 18%, transparent)"
              : "color-mix(in oklab, hsl(var(--bg)) 12%, transparent)",
        } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-36"
        style={{
          background:
            "radial-gradient(160% 90% at 50% -12%, color-mix(in oklab, white 42%, transparent), transparent 58%), repeating-linear-gradient(180deg, color-mix(in oklab, hsl(var(--fg)) 1.6%, transparent) 0 1px, transparent 1px 24px)",
          mixBlendMode: "multiply",
        }}
      />

      {patternStyle === "seal" ? (
        <SealPatternLayer tone="base" opacity={patternOpacity} scale={patternScale} motion={patternMotion} />
      ) : patternStyle === "essay" ? (
        <EssayPatternLayer tone="base" opacity={Math.min(patternOpacity * 0.92, 1.22)} scale={patternScale} motion={patternMotion} />
      ) : patternStyle === "clerical" ? (
        <ClericalPatternLayer token={token} tone="base" opacity={patternOpacity} scale={patternScale} motion={patternMotion} />
      ) : (
        <TextPatternLayer token={token} tone="base" opacity={patternOpacity} scale={patternScale} motion={patternMotion} />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklab, hsl(var(--bg)) 98%, white) 0%, color-mix(in oklab, hsl(var(--bg)) 96%, white) 34%, color-mix(in oklab, hsl(var(--bg)) 68%, transparent) 60%, transparent 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden will-change-[clip-path]"
        style={{
          clipPath: "circle(var(--hb-spot-r, 0px) at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%))",
          opacity: overlayOpacity,
        }}
      >
        <div
          className="absolute inset-[-10%]"
          style={{
            background:
              "radial-gradient(220px 150px at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%), color-mix(in oklab, white 72%, hsl(var(--bg))) 0%, color-mix(in oklab, hsl(var(--bg)) 94%, white) 40%, color-mix(in oklab, hsl(var(--card)) 82%, transparent) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(150px 118px at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%), color-mix(in oklab, white 58%, transparent), color-mix(in oklab, hsl(var(--bg)) 10%, transparent) 64%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-28"
          style={{
            background:
              "repeating-linear-gradient(180deg, color-mix(in oklab, hsl(var(--fg)) 2.4%, transparent) 0 1px, transparent 1px 20px)",
            mixBlendMode: "multiply",
          }}
        />
        {patternStyle === "seal" ? (
          <SealPatternLayer tone="inverted" opacity={patternOpacity * 0.14} scale={patternScale} motion={patternMotion} />
        ) : patternStyle === "essay" ? (
          <EssayPatternLayer
            tone="inverted"
            opacity={Math.min(patternOpacity * 0.62, 0.52)}
            scale={patternScale}
            motion={patternMotion}
          />
        ) : patternStyle === "clerical" ? (
          <ClericalPatternLayer
            token={token}
            tone="inverted"
            opacity={Math.min(patternOpacity * 0.34, 0.42)}
            scale={patternScale}
            motion={patternMotion}
          />
        ) : (
          <TextPatternLayer
            token={token}
            tone="inverted"
            opacity={patternOpacity * 0.14}
            scale={patternScale}
            motion={patternMotion}
          />
        )}
      </div>
    </div>
  );
}
