import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { HeroMimoBackdrop } from "../components/HeroMimoBackdrop";
import { SectionHeader } from "../components/SectionHeader";
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
    return (id: string) => m.get(id) ?? id;
  }, [categories]);

  React.useEffect(() => {
    let cancelled = false;
    api
      .notes()
      .then((n) => {
        if (cancelled) return;
        setNotes(n.slice(0, 6));
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

  const flushSpot = React.useCallback(() => {
    if (heroVariant !== "mimo") {
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
    const targetR = target.active ? spotRadius : 0;

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

    cur.x += dx * spotlightEase;
    cur.y += dy * spotlightEase;
    cur.tx += dtx * spotlightEase;
    cur.ty += dty * spotlightEase;
    cur.r += dr * spotlightEaseRadius;

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
      target.active ||
      Math.abs(dx) > 0.5 ||
      Math.abs(dy) > 0.5 ||
      Math.abs(dtx) > 0.5 ||
      Math.abs(dty) > 0.5 ||
      Math.abs(dr) > 0.5;

    const wantsMore = needsMore || pendingRef.current;
    rafRef.current = wantsMore ? window.requestAnimationFrame(flushSpot) : null;
  }, [heroVariant, spotRadius, spotlightEase, spotlightEaseRadius]);

  const scheduleFlush = React.useCallback(() => {
    if (rafRef.current !== null) {
      pendingRef.current = true;
      return;
    }
    rafRef.current = window.requestAnimationFrame(flushSpot);
  }, [flushSpot]);

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
                      ? "font-sans font-bold leading-none tracking-[0.02em]"
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
                      className="font-sans font-bold leading-none tracking-[0.02em]"
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

      <section className="grid gap-4">
        <SectionHeader
          title="Latest Notes"
          desc="不区分长短文：同一个 Note，既能挂到 Category，也能挂到 Roadmap 节点。"
          right={
            <Link to="/notes" className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]">
              浏览全部 →
            </Link>
          }
        />
        {notes.length ? (
          <div className="card overflow-hidden">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
              <Link
                to={`/notes/${notes[0]!.id}`}
                className="group bg-[hsl(var(--card))] p-6 transition hover:bg-[hsl(var(--card2))] md:p-7"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">
                    LATEST
                  </div>
                  <div className="font-mono text-xs tabular-nums text-[hsl(var(--muted))]">
                    {fmtYmd(notes[0]!.updated)}
                  </div>
                </div>

                <h3 className="mt-3 font-serif text-2xl font-semibold leading-[1.12] tracking-tight md:text-3xl">
                  {notes[0]!.title}
                </h3>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[hsl(var(--muted))] md:text-base">
                  {notes[0]!.excerpt}
                </p>

                {(() => {
                  const n = notes[0]!;
                  const cat = n.categories[0] ? `#${categoryTitleById(n.categories[0])}` : null;
                  const node = n.nodes[0] ? `${n.nodes[0].roadmapTitle} / ${n.nodes[0].title}` : null;
                  const meta = [cat, node].filter(Boolean).join(" · ");
                  if (!meta) return null;
                  return (
                    <div className="mt-4 line-clamp-2 text-xs leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_58%,hsl(var(--muted)))]">
                      {meta}
                    </div>
                  );
                })()}

                <div className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-[hsl(var(--muted))] transition group-hover:text-[hsl(var(--fg))]">
                  Read <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
                </div>
              </Link>

              <div className="bg-[hsl(var(--card))]">
                <div className="h-full border-t border-[color:var(--border-soft)] lg:border-l lg:border-t-0">
                  <div className="divide-y divide-[color:var(--border-soft)]">
                    {notes.slice(1, 6).map((n) => {
                      const cat = n.categories[0] ? `#${categoryTitleById(n.categories[0])}` : null;
                      const node = n.nodes[0] ? `${n.nodes[0].roadmapTitle} / ${n.nodes[0].title}` : null;
                      const meta = [cat, node].filter(Boolean).join(" · ");
                      const mmdd = fmtYmd(n.updated).slice(5);

                      return (
                        <Link
                          key={n.id}
                          to={`/notes/${n.id}`}
                          className="group block px-5 py-4 transition hover:bg-[hsl(var(--card2))]"
                        >
                          <div className="flex items-baseline justify-between gap-4">
                            <div className="min-w-0 truncate font-serif text-sm font-semibold tracking-tight md:text-base">
                              {n.title}
                            </div>
                            <div className="shrink-0 font-mono text-xs tabular-nums text-[hsl(var(--muted))]">
                              {mmdd}
                            </div>
                          </div>
                          <div className="mt-1 line-clamp-1 text-xs leading-relaxed text-[hsl(var(--muted))]">
                            {n.excerpt}
                          </div>
                          {meta ? (
                            <div className="mt-1 line-clamp-1 text-[11px] text-[color-mix(in_oklab,hsl(var(--fg))_52%,hsl(var(--muted)))]">
                              {meta}
                            </div>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-7 text-sm text-[hsl(var(--muted))]">暂无 Notes。</div>
        )}
      </section>

      <section className="grid gap-4">
        <SectionHeader
          title="Categories"
          desc="传统目录入口：适合对外叙述与长期沉淀。"
          right={
            <Link to="/categories" className="text-sm text-[hsl(var(--muted))] hover:text-[hsl(var(--fg))]">
              查看全部 →
            </Link>
          }
        />
        <div className="card p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 6).map((c) => (
              <Link
                key={c.id}
                to={`/categories/${c.id}`}
                className="group rounded-xl border border-[color:var(--border-soft)] bg-[var(--surface-muted-weak)] px-4 py-3 transition hover:border-[color:var(--border-hover)] hover:bg-[var(--surface-muted)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <div className="font-serif text-base font-semibold tracking-tight">{c.title}</div>
                      <div className="font-mono text-xs text-[hsl(var(--muted))]">/{c.id}</div>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-[hsl(var(--muted))]">
                      {c.description ?? "传统目录入口：像写书一样维护栏目结构与叙事。"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-[hsl(var(--fg))]">{c.noteCount ?? 0}</div>
                    <div className="mt-0.5 text-[10px] font-semibold tracking-[var(--tracking-wide)] text-[hsl(var(--muted))]">NOTES</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
