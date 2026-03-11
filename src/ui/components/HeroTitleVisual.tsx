import React from "react";

const SEAL_GLYPHS: Record<
  string,
  {
    src: string;
    widthEm: number;
    heightEm?: number;
    shiftYEm?: number;
  }
> = {
  朝: { src: "/hero-title/chao-slip.svg", widthEm: 1.08, heightEm: 0.98, shiftYEm: 0.03 },
  花: { src: "/hero-title/hua-seal.svg", widthEm: 0.92, heightEm: 1.08, shiftYEm: 0.01 },
  夕: { src: "/hero-title/xi-seal.svg", widthEm: 0.7, heightEm: 1.06, shiftYEm: 0.02 },
  拾: { src: "/hero-title/shi-seal.svg", widthEm: 0.98, heightEm: 1.08 },
};

export function supportsSealGlyphs(text: string): boolean {
  const chars = Array.from(text);
  return chars.length > 0 && chars.every((char) => Boolean(SEAL_GLYPHS[char]));
}

export function HeroTitleVisual(props: {
  text: string;
  variant: "text" | "seal" | "cursive";
  className?: string;
  style?: React.CSSProperties;
  ariaHidden?: boolean;
}) {
  if (props.variant === "cursive") {
    return (
      <span
        className={["hero-cursive-title", props.className].filter(Boolean).join(" ")}
        style={props.style}
        aria-hidden={props.ariaHidden || undefined}
      >
        {props.text}
      </span>
    );
  }

  if (props.variant !== "seal") {
    return (
      <span className={props.className} style={props.style} aria-hidden={props.ariaHidden || undefined}>
        {props.text}
      </span>
    );
  }

  const chars = Array.from(props.text);
  if (!supportsSealGlyphs(props.text)) {
    return (
      <span className={props.className} style={props.style} aria-hidden={props.ariaHidden || undefined}>
        {props.text}
      </span>
    );
  }

  return (
    <span
      className={["hero-seal-title", props.className].filter(Boolean).join(" ")}
      style={props.style}
      aria-hidden={props.ariaHidden || undefined}
    >
      {chars.map((char, index) => {
        const glyph = SEAL_GLYPHS[char]!;
        return (
          <span
            key={`${char}-${index}`}
            className="hero-seal-glyph"
            style={
              {
                "--hero-seal-url": `url("${glyph.src}")`,
                "--hero-seal-width": `${glyph.widthEm}em`,
                "--hero-seal-height": `${glyph.heightEm ?? 1}em`,
                "--hero-seal-shift-y": `${glyph.shiftYEm ?? 0}em`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
