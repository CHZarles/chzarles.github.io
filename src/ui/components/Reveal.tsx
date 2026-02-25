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
  const [shown, setShown] = React.useState(() => {
    if (prefersReducedMotion()) return true;
    try {
      // On hard refresh we already run a global fade-in; avoid stacked "double" reveals.
      if (document.documentElement.dataset.hbMounted === "0") return true;
    } catch {
      // ignore
    }
    return false;
  });

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
      // Use a 0 threshold to avoid the "giant content never reaches ratio threshold" trap.
      // (e.g. long notes where viewport/elementHeight < 0.15)
      { rootMargin: "0px 0px -10% 0px", threshold: 0 },
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
        transition: `opacity 460ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms, transform 460ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={props.className} style={{ ...transitionStyle, ...motionStyle, ...props.style }}>
      {props.children}
    </div>
  );
}
