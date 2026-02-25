import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { HeroMimoBackdrop } from "../components/HeroMimoBackdrop";
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
  const { profile, theme, categories } = useAppState();
  const [notes, setNotes] = React.useState<NoteListItem[]>([]);

  const categoryTitleById = React.useMemo(() => {
    const m = new Map(categories.map((c) => [c.id, c.title] as const));
    return (id: string) => m.get(id) ?? null;
  }, [categories]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .notes()
      .then((n) => {
        if (cancelled) return;
        setNotes(n.slice(0, 10));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const heroVariant: "image" | "mimo" =
    profile?.hero?.variant === "mimo" ? "mimo" : profile?.hero?.imageUrl ? "image" : "mimo";

  const heroTitleText = profile?.hero?.title ?? profile?.name ?? "Hyperblog";
  const heroTaglineText =
    profile?.hero?.tagline ?? profile?.tagline ?? "把 Notes、Categories 与 Roadmaps 三套入口合一：可读、可索引、可证明。";

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
  const heroTaglineSize =
    heroVariant === "mimo"
      ? `clamp(${(1.00 * heroScale).toFixed(3)}rem, ${(1.25 * heroScale).toFixed(3)}vw, ${(1.18 * heroScale).toFixed(3)}rem)`
      : `clamp(${(0.95 * heroScale).toFixed(3)}rem, ${(1.15 * heroScale).toFixed(3)}vw, ${(1.06 * heroScale).toFixed(3)}rem)`;
  const heroHandleSize =
    heroVariant === "mimo"
      ? `clamp(${(0.95 * heroScale).toFixed(3)}rem, ${(1.45 * heroScale).toFixed(3)}vw, ${(1.15 * heroScale).toFixed(3)}rem)`
      : undefined;

  const heroTaglineClass =
    heroVariant === "mimo"
      ? "mt-6 mx-auto max-w-[62ch] font-serif font-medium leading-[1.95] tracking-[-0.018em]"
      : "mt-5 mx-auto max-w-[64ch] leading-relaxed tracking-[-0.01em]";

  const mimoHandleClass = [
    "mt-6 inline-flex items-center justify-center",
    "border-b border-[color-mix(in_oklab,hsl(var(--accent))_58%,transparent)] pb-1",
    "font-mono font-semibold tracking-[0.14em] text-[hsl(var(--accent))]",
  ].join(" ");

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
          "relative flex overflow-hidden",
          heroVariant === "mimo"
            ? "h-[420px] sm:h-[470px] md:h-[500px] cursor-crosshair"
            : "min-h-[440px] md:min-h-[clamp(560px,64vh,860px)]",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          ref={heroBackdropRef}
          className={[
            "absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y",
            heroVariant === "mimo"
              ? "border-[hsl(var(--fg))] bg-[hsl(var(--bg))]"
              : "border-[color-mix(in_oklab,hsl(var(--fg))_22%,hsl(var(--border)))] bg-[hsl(var(--card))]",
          ].join(" ")}
        >
          {heroVariant === "mimo" ? (
            <HeroMimoBackdrop
              patternText={profile?.hero?.patternText ?? profile?.handle ?? profile?.hero?.title ?? profile?.name ?? "HYPERBLOG"}
              patternOpacity={profile?.hero?.patternOpacity}
              patternScale={profile?.hero?.patternScale}
              patternMotion={profile?.hero?.patternMotion}
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
            heroVariant === "mimo" ? "" : "py-12 md:py-16",
          ].join(" ")}
        >
          <div className="w-full">
            <div className="mx-auto flex max-w-[72rem] flex-col items-center px-1 text-center">
              <div ref={titleSpotRef} className="relative w-full max-w-[78ch]">
                <h1
                  className={[
                    heroVariant === "mimo"
                      ? "font-sans font-bold leading-none tracking-[0.01em]"
                      : "hero-ink font-serif font-semibold leading-[0.98] tracking-tight",
                  ].join(" ")}
                  style={{ color: heroFg, fontSize: heroTitleSize }}
                >
                  {heroTitleText}
                </h1>
                {heroVariant === "mimo" ? (
                  <div className={mimoHandleClass} style={{ fontSize: heroHandleSize }}>
                    {profile?.handle ?? "@you"}
                  </div>
                ) : (
                  <div className="mt-4 font-mono font-medium tracking-[-0.02em] text-[hsl(var(--accent))]">
                    {profile?.handle ?? "@you"}
                  </div>
                )}
                <p
                  className={heroTaglineClass}
                  style={{
                    color: heroVariant === "mimo" ? "hsl(var(--muted))" : heroFg,
                    opacity: heroVariant === "mimo" ? 0.92 : 0.82,
                    fontSize: heroTaglineSize,
                  }}
                >
                  {heroTaglineText}
                </p>

                {heroVariant === "mimo" ? (
                  <div
                    className="pointer-events-none absolute inset-0 will-change-[clip-path]"
                    style={{
                      clipPath: "circle(var(--hb-spot-r, 0px) at var(--hb-spot-x, 50%) var(--hb-spot-y, 50%))",
                    }}
                  >
                    <h1
                      className="font-sans font-bold leading-none tracking-[0.01em]"
                      style={{ color: "hsl(var(--bg))", fontSize: heroTitleSize }}
                    >
                      {heroTitleText}
                    </h1>
                    <div className={mimoHandleClass} style={{ fontSize: heroHandleSize }}>
                      {profile?.handle ?? "@you"}
                    </div>
                    <p
                      className={heroTaglineClass}
                      style={{ color: "color-mix(in oklab, hsl(var(--bg)) 86%, transparent)", fontSize: heroTaglineSize }}
                    >
                      {heroTaglineText}
                    </p>
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
        <Reveal className="relative z-10 py-10" yPx={12}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-0 lg:divide-x lg:divide-[color:var(--border-soft)]">
            <div className="min-w-0 lg:pr-10">
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
                  <Link
                    to={`/notes/${notes[0]!.id}`}
                    onMouseEnter={() => api.prefetchNote(notes[0]!.id)}
                    onFocus={() => api.prefetchNote(notes[0]!.id)}
                    className="group block rounded-2xl px-1 py-2 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <div className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                        {fmtYmd(notes[0]!.updated).slice(0, 10)}
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 opacity-40 transition group-hover:opacity-70" />
                    </div>
                    <div className="mt-3 font-serif text-2xl font-semibold leading-[1.12] tracking-tight md:text-3xl">
                      {notes[0]!.title}
                    </div>
                    <div className="mt-3 line-clamp-3 text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_72%,hsl(var(--muted)))] md:text-base">
                      {notes[0]!.excerpt}
                    </div>
                  </Link>

                  <div className="mt-6 hairline" />

                  <div className="divide-y divide-[color:var(--border-soft)]">
                    {notes.slice(1, 9).map((n, idx) => {
                      const index = String(idx + 2).padStart(2, "0");
                      const md = fmtYmd(n.updated).slice(5);
                      const date = md.length === 5 ? md.replace("-", ".") : md;
                      const catTitle = n.categories[0] ? categoryTitleById(n.categories[0]) : null;
                      const cat = catTitle ? `#${catTitle}` : null;
                      const node = n.nodes[0] ? `${n.nodes[0].roadmapTitle} / ${n.nodes[0].title}` : null;
                      const meta = [cat, node].filter(Boolean).join(" · ");

                      return (
                        <Link
                          key={n.id}
                          to={`/notes/${n.id}`}
                          onMouseEnter={() => api.prefetchNote(n.id)}
                          onFocus={() => api.prefetchNote(n.id)}
                          className="group relative -mx-1 grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-4 rounded-xl px-1 py-3.5 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
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
                            {meta ? (
                              <div className="mt-1 hidden line-clamp-1 text-[11px] text-[color-mix(in_oklab,hsl(var(--fg))_60%,hsl(var(--muted)))] md:block">
                                {meta}
                              </div>
                            ) : null}
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

            <div className="min-w-0 lg:pl-10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
                    INDEX
                  </div>
                  <div className="mt-1 font-serif text-xl font-semibold tracking-tight">Categories</div>
                </div>
                <Link
                  to="/notes"
                  className="font-mono text-xs font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]"
                >
                  ALL →
                </Link>
              </div>

              {categories.length ? (
                <div className="mt-5">
                  <div className="hairline" />
                  <div className="divide-y divide-[color:var(--border-soft)]">
                    {categories.slice(0, 10).map((c) => (
                      <Link
                        key={c.id}
                        to={`/notes?category=${encodeURIComponent(c.id)}`}
                        className="group relative -mx-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 rounded-xl px-1 py-3.5 transition hover:bg-[color-mix(in_oklab,hsl(var(--card2))_45%,transparent)]"
                      >
                        <div className="pointer-events-none absolute inset-y-3 left-0 w-px bg-[hsl(var(--accent))] opacity-0 transition group-hover:opacity-35" />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <div className="truncate font-serif text-sm font-semibold tracking-tight md:text-base">
                              {c.title}
                            </div>
                          </div>
                          {c.description ? (
                            <div className="mt-1 hidden line-clamp-1 text-[11px] text-[hsl(var(--muted))] md:block">
                              {c.description}
                            </div>
                          ) : null}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums tracking-[0.18em] text-[hsl(var(--muted))]">
                          {(c.noteCount ?? 0).toString().padStart(2, "0")}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 text-sm text-[hsl(var(--muted))]">暂无 Categories。</div>
              )}
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
