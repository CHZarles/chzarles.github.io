import React from "react";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  } catch {
    return false;
  }
}

export function Reveal(props: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delayMs?: number;
  yPx?: number;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    if (shown) return;
    if (prefersReducedMotion()) {
      setShown(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shown]);

  const delayMs = Math.max(0, Math.min(1000, props.delayMs ?? 0));
  const yPx = Math.max(0, Math.min(40, props.yPx ?? 10));
  const reduce = prefersReducedMotion();

  const motionStyle: React.CSSProperties =
    reduce || shown
      ? { opacity: 1, transform: "none" }
      : {
          opacity: 0,
          transform: `translate3d(0, ${yPx}px, 0)`,
        };

  const transitionStyle: React.CSSProperties = reduce
    ? {}
    : {
        transition: `opacity 560ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms, transform 560ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={props.className} style={{ ...transitionStyle, ...motionStyle, ...props.style }}>
      {props.children}
    </div>
  );
}

