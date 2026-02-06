import React from "react";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function HeroBackdrop(props: {
  imageUrl?: string;
  blurPx?: number;
  opacity?: number;
  position?: string;
}) {
  const blurPx = clamp(props.blurPx ?? 22, 0, 60);
  const opacity = clamp(props.opacity ?? 0.25, 0, 1);
  const position = props.position ?? "center";

  const filter = React.useMemo(() => {
    if (!props.imageUrl) return undefined;
    return `blur(${blurPx}px) saturate(1.15) contrast(1.05)`;
  }, [props.imageUrl, blurPx]);

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
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 18% 12%, color-mix(in oklab, hsl(var(--accent)) 18%, transparent), transparent 62%), radial-gradient(1000px 520px at 82% 38%, color-mix(in oklab, hsl(var(--accent)) 10%, transparent), transparent 60%)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklab, hsl(var(--card)) 92%, transparent) 55%, hsl(var(--card)))",
          opacity: 0.35,
        }}
      />
    </div>
  );
}

