import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function HeroBackdrop(props: {
  imageUrl?: string;
  blurPx?: number;
  opacity?: number;
  position?: string;
  tintOpacity?: number;
  washOpacity?: number;
  saturate?: number;
  contrast?: number;
}) {
  const blurPx = clamp(props.blurPx ?? 22, 0, 60);
  const opacity = clamp(props.opacity ?? 0.25, 0, 1);
  const position = props.position ?? "center";
  const tintOpacity = clamp(props.tintOpacity ?? 0.9, 0, 1);
  const washOpacity = clamp(props.washOpacity ?? 0.28, 0, 1);
  const saturate = clamp(props.saturate ?? 1.15, 0, 3);
  const contrast = clamp(props.contrast ?? 1.05, 0, 3);

  const filter = React.useMemo(() => {
    if (!props.imageUrl) return undefined;
    return `blur(${blurPx}px) saturate(${saturate}) contrast(${contrast})`;
  }, [props.imageUrl, blurPx, saturate, contrast]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {props.imageUrl ? (
        <img
          src={props.imageUrl}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity,
            filter,
            transform: "scale(1.08)",
            objectPosition: position,
          }}
        />
      ) : null}
      {tintOpacity > 0 ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 420px at 18% 12%, color-mix(in oklab, hsl(var(--accent)) 18%, transparent), transparent 62%), radial-gradient(1000px 520px at 82% 38%, color-mix(in oklab, hsl(var(--accent)) 10%, transparent), transparent 60%)",
            opacity: tintOpacity,
          }}
        />
      ) : null}
      {washOpacity > 0 ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, transparent 62%, color-mix(in oklab, hsl(var(--card)) 88%, transparent) 82%, hsl(var(--card)) 100%)",
            opacity: washOpacity,
          }}
        />
      ) : null}
    </div>
  );
}
