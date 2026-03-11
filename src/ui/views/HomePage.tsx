import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { HeroMimoBackdrop } from "../components/HeroMimoBackdrop";
import { HeroTitleVisual } from "../components/HeroTitleVisual";
import { Reveal } from "../components/Reveal";
import { useAppState } from "../state/AppState";
import type { NoteListItem } from "../types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmtYmd(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function cssColor(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (
    s.startsWith("hsl(") ||
    s.startsWith("rgb(") ||
    s.startsWith("rgba(") ||
    s.startsWith("#") ||
    s.startsWith("color-mix(")
  ) {
    return s;
  }
  return `hsl(${s})`;
}

export function HomePage() {
  const { profile, theme } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void api.notes().then((allNotes) => {
      if (cancelled) return;
      setNotes(allNotes.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const heroVariant: "image" | "mimo" =
    profile?.hero?.variant === "mimo" ? "mimo" : profile?.hero?.imageUrl ? "image" : "mimo";

  const heroTitleText = profile?.hero?.title ?? profile?.name ?? "Hyperblog";
  const heroTitleVariant =
    profile?.hero?.titleStyle === "seal" ? "seal" : profile?.hero?.titleStyle === "cursive" ? "cursive" : "text";
  const heroPatternVariant =
    profile?.hero?.patternStyle === "seal"
      ? "seal"
      : profile?.hero?.patternStyle === "clerical"
        ? "clerical"
        : profile?.hero?.patternStyle === "essay"
          ? "essay"
        : "text";
  const heroTaglineText = profile?.hero?.tagline?.trim() ?? profile?.tagline?.trim() ?? "";
  const heroTitleFrameClass = heroVariant === "mimo" ? "leading-none" : "hero-ink leading-[0.98]";
  const heroTitleInnerClass =
    heroTitleVariant === "seal"
      ? undefined
      : heroTitleVariant === "cursive"
        ? undefined
        : heroVariant === "mimo"
          ? "font-sans font-bold tracking-[0.01em]"
          : "font-serif font-semibold tracking-tight";

  const heroFg = (() => {
    if (heroVariant === "mimo") return "hsl(var(--fg))";
    const cfg = profile?.hero?.textColor;
    const raw = theme === "dark" ? cfg?.dark : cfg?.light;
    return raw ? cssColor(raw) : "hsl(var(--hero-fg))";
  })();

  const heroScale = clamp(profile?.hero?.textScale ?? 1, 0.85, heroVariant === "mimo" ? 1.6 : 1.25);
  const heroTitleSize =
    heroVariant === "mimo"
      ? `clamp(${(3.2 * heroScale).toFixed(3)}rem, ${(7.2 * heroScale).toFixed(3)}vw, ${(6.0 * heroScale).toFixed(3)}rem)`
      : `clamp(${(2.25 * heroScale).toFixed(3)}rem, ${(4.4 * heroScale).toFixed(3)}vw, ${(3.25 * heroScale).toFixed(3)}rem)`;
  const heroRef = React.useRef<HTMLElement | null>(null);
  const heroBackdropRef = React.useRef<HTMLDivElement | null>(null);
  const titleSpotRef = React.useRef<HTMLDivElement | null>(null);
  const spotRadius = clamp(profile?.hero?.spotlightRadiusPx ?? 240, 120, 520);
  const spotlightEase = clamp(profile?.hero?.spotlightEase ?? 0.34, 0.05, 0.5);
  const spotlightEaseRadius = clamp(profile?.hero?.spotlightEaseRadius ?? spotlightEase, 0.05, 0.5);
  const heroVariantRef = React.useRef(heroVariant);
  const spotRadiusRef = React.useRef(spotRadius);
  const spotlightEaseRef = React.useRef(spotlightEase);
  const spotlightEaseRadiusRef = React.useRef(spotlightEaseRadius);
  const rafRef = React.useRef<number | null>(null);
  const pendingRef = React.useRef(false);
  const lastRef = React.useRef<{ x: number; y: number; tx: number; ty: number; active: boolean }>({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    active: false,
  });
  const animRef = React.useRef<{ x: number; y: number; tx: number; ty: number; r: number }>({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    r: 0,
  });

  React.useEffect(() => {
    heroVariantRef.current = heroVariant;
    spotRadiusRef.current = spotRadius;
    spotlightEaseRef.current = spotlightEase;
    spotlightEaseRadiusRef.current = spotlightEaseRadius;
  }, [heroVariant, spotRadius, spotlightEase, spotlightEaseRadius]);

  const flushSpot = React.useCallback(() => {
    if (heroVariantRef.current !== "mimo") {
      rafRef.current = null;
      pendingRef.current = false;
      return;
    }
    const backdropEl = heroBackdropRef.current;
    if (!backdropEl) {
      rafRef.current = null;
      pendingRef.current = false;
      return;
    }

    pendingRef.current = false;
    const target = lastRef.current;
    const cur = animRef.current;
    const targetR = target.active ? spotRadiusRef.current : 0;

    if (target.active && cur.r < 1) {
      cur.x = target.x;
      cur.y = target.y;
      cur.tx = target.tx;
      cur.ty = target.ty;
    }

    const dx = target.x - cur.x;
    const dy = target.y - cur.y;
    const dtx = target.tx - cur.tx;
    const dty = target.ty - cur.ty;
    const dr = targetR - cur.r;

    const ease = spotlightEaseRef.current;
    const easeR = spotlightEaseRadiusRef.current;
    cur.x += dx * ease;
    cur.y += dy * ease;
    cur.tx += dtx * ease;
    cur.ty += dty * ease;
    cur.r += dr * easeR;

    backdropEl.style.setProperty("--hb-spot-x", `${cur.x}px`);
    backdropEl.style.setProperty("--hb-spot-y", `${cur.y}px`);
    backdropEl.style.setProperty("--hb-spot-r", `${cur.r}px`);

    const titleEl = titleSpotRef.current;
    if (titleEl) {
      titleEl.style.setProperty("--hb-spot-x", `${cur.tx}px`);
      titleEl.style.setProperty("--hb-spot-y", `${cur.ty}px`);
      titleEl.style.setProperty("--hb-spot-r", `${cur.r}px`);
    }

    const needsMore =
      Math.abs(dx) > 0.5 ||
      Math.abs(dy) > 0.5 ||
      Math.abs(dtx) > 0.5 ||
      Math.abs(dty) > 0.5 ||
      Math.abs(dr) > 0.5;

    const wantsMore = needsMore || pendingRef.current;
    rafRef.current = wantsMore ? window.requestAnimationFrame(flushSpot) : null;
  }, []);

  const scheduleFlush = React.useCallback(() => {
    if (rafRef.current !== null) {
      pendingRef.current = true;
      return;
    }
    rafRef.current = window.requestAnimationFrame(flushSpot);
  }, [flushSpot]);

  React.useEffect(() => {
    if (heroVariant !== "mimo") return;
    if (!lastRef.current.active) return;
    scheduleFlush();
  }, [heroVariant, spotRadius, spotlightEase, spotlightEaseRadius, scheduleFlush]);

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (heroVariant !== "mimo") return;
      if (e.pointerType === "touch") return;
      const backdropEl = heroBackdropRef.current;
      if (!backdropEl) return;

      const rect = backdropEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let tx = x;
      let ty = y;
      const titleEl = titleSpotRef.current;
      if (titleEl) {
        const tr = titleEl.getBoundingClientRect();
        tx = e.clientX - tr.left;
        ty = e.clientY - tr.top;
      }

      lastRef.current = { x, y, tx, ty, active: true };
      scheduleFlush();
    },
    [heroVariant, scheduleFlush],
  );

  const onPointerLeave = React.useCallback(() => {
    if (heroVariant !== "mimo") return;
    lastRef.current = { ...lastRef.current, active: false };
    scheduleFlush();
  }, [heroVariant, scheduleFlush]);

  return (
    <div className="grid gap-8">
      <section
        ref={heroRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className={[
          "relative mx-auto flex w-full max-w-[56rem] overflow-hidden",
          heroVariant === "mimo"
            ? "h-[264px] sm:h-[280px] md:h-[296px] cursor-crosshair"
            : "min-h-[400px] md:min-h-[clamp(500px,58vh,720px)]",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          ref={heroBackdropRef}
          className={[
            "absolute inset-0 overflow-hidden border-y",
            heroVariant === "mimo"
              ? "border-[hsl(var(--fg))] bg-[hsl(var(--bg))]"
              : "border-[color-mix(in_oklab,hsl(var(--fg))_22%,hsl(var(--border)))] bg-[hsl(var(--card))]",
          ].join(" ")}
        >
          {heroVariant === "mimo" ? (
            <HeroMimoBackdrop
              patternText={profile?.hero?.patternText ?? profile?.hero?.title ?? profile?.name ?? profile?.handle ?? "HYPERBLOG"}
              patternStyle={heroPatternVariant}
              patternOpacity={profile?.hero?.patternOpacity}
              patternScale={profile?.hero?.patternScale}
              patternMotion={profile?.hero?.patternMotion}
              spotlightSceneUrl={profile?.hero?.spotlightSceneUrl}
              spotlightScenePosition={profile?.hero?.spotlightScenePosition}
              spotlightSceneOpacity={profile?.hero?.spotlightSceneOpacity}
              spotlightSceneScale={profile?.hero?.spotlightSceneScale}
            />
          ) : (
            <HeroBackdrop
              imageUrl={profile?.hero?.imageUrl}
              preload={profile?.hero?.preload}
              blurPx={profile?.hero?.blurPx}
              opacity={profile?.hero?.opacity}
              position={profile?.hero?.position}
              tintOpacity={profile?.hero?.tintOpacity}
              washOpacity={profile?.hero?.washOpacity}
              saturate={profile?.hero?.saturate}
              contrast={profile?.hero?.contrast}
            />
          )}
        </div>
        <div
          className={[
            "relative z-10 flex flex-1 flex-col items-center justify-center",
            heroVariant === "mimo" ? "py-5 md:py-6" : "py-10 md:py-14",
          ].join(" ")}
        >
          <div className="w-full">
            <div className="mx-auto flex max-w-[56rem] flex-col items-center px-3 text-center">
              <div ref={titleSpotRef} className="relative mx-auto flex w-full max-w-[56ch] flex-col items-center">
                <h1
                  className={[heroTitleFrameClass, "mx-auto flex w-full justify-center text-center"].join(" ")}
                  style={{ color: heroFg, fontSize: heroTitleSize }}
                >
                  {heroTitleVariant === "seal" ? <span className="sr-only">{heroTitleText}</span> : null}
                  <HeroTitleVisual
                    text={heroTitleText}
                    variant={heroTitleVariant}
                    className={heroTitleInnerClass}
                    ariaHidden={heroTitleVariant === "seal"}
                  />
                </h1>
                {heroTaglineText ? (
                  <p
                    className={
                      heroVariant === "mimo"
                        ? "mt-4 mx-auto max-w-[54ch] font-serif font-medium leading-[1.85] tracking-[-0.018em]"
                        : "mt-4 mx-auto max-w-[58ch] leading-relaxed tracking-[-0.01em]"
                    }
                    style={{
                      color: heroVariant === "mimo" ? "hsl(var(--muted))" : heroFg,
                      opacity: heroVariant === "mimo" ? 0.92 : 0.82,
                      fontSize:
                        heroVariant === "mimo"
                          ? `clamp(${(1.00 * heroScale).toFixed(3)}rem, ${(1.25 * heroScale).toFixed(3)}vw, ${(1.18 * heroScale).toFixed(3)}rem)`
                          : `clamp(${(0.95 * heroScale).toFixed(3)}rem, ${(1.15 * heroScale).toFixed(3)}vw, ${(1.06 * heroScale).toFixed(3)}rem)`,
                    }}
                  >
                    {heroTaglineText}
                  </p>
                ) : null}

                {heroVariant === "mimo" ? (
                  <div
                    className="pointer-events-none absolute inset-0 will-change-[clip-path]"
                    style={{
                      clipPath: "circle(var(--hb-spot-r, 0px) at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%))",
                    }}
                  >
                    <div
                      className={[heroTitleFrameClass, "mx-auto flex w-full justify-center text-center"].join(" ")}
                      style={{ color: "hsl(var(--bg))", fontSize: heroTitleSize }}
                    >
                      <HeroTitleVisual
                        text={heroTitleText}
                        variant={heroTitleVariant}
                        className={heroTitleInnerClass}
                        ariaHidden
                      />
                    </div>
                    {heroTaglineText ? (
                      <p
                        className="mt-4 mx-auto max-w-[54ch] font-serif font-medium leading-[1.85] tracking-[-0.018em]"
                        style={{
                          color: "color-mix(in oklab, hsl(var(--bg)) 86%, transparent)",
                          fontSize: `clamp(${(1.00 * heroScale).toFixed(3)}rem, ${(1.25 * heroScale).toFixed(3)}vw, ${(1.18 * heroScale).toFixed(3)}rem)`,
                        }}
                      >
                        {heroTaglineText}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 border-y border-[color-mix(in_oklab,hsl(var(--fg))_18%,hsl(var(--border)))] bg-[color-mix(in_oklab,hsl(var(--bg))_72%,transparent)]"
        />
        <Reveal className="relative z-10 py-8 md:py-10" yPx={12}>
          <div className="mx-auto max-w-[56rem]">
            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
                    LATEST
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold tracking-tight">Notes</div>
                </div>
                <Link
                  to="/notes"
                  className="font-mono text-xs font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                >
                  ALL →
                </Link>
              </div>

              {notes.length ? (
                <div className="mt-5">
                  <div className="divide-y divide-[color:var(--border-soft)]">
                    {notes.slice(0, 5).map((n, idx) => {
                      const index = String(idx + 1).padStart(2, "0");
                      const md = fmtYmd(n.updated).slice(5);
                      const date = md.length === 5 ? md.replace("-", ".") : md;

                      return (
                        <Link
                          key={n.id}
                          to={`/notes/${n.id}`}
                          onMouseEnter={() => api.prefetchNote(n.id)}
                          onFocus={() => api.prefetchNote(n.id)}
                          className="group relative -mx-1 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-4 rounded-xl px-1 py-4 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
                        >
                          <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[hsl(var(--accent))] opacity-0 transition group-hover:opacity-45" />
                          <div className="pt-0.5 font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                            {index}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="min-w-0 truncate font-serif text-sm font-semibold tracking-tight md:text-base">
                                {n.title}
                              </div>
                              <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-px opacity-0 transition group-hover:opacity-60" />
                            </div>
                          </div>
                          <div className="pt-0.5 font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                            {date}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-5 text-sm text-[hsl(var(--muted))]">暂无 Notes。</div>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
