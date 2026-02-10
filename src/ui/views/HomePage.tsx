import { ArrowUpRight } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { Chip } from "../components/Chip";
import { HeroBackdrop } from "../components/HeroBackdrop";
import { HeroMimoBackdrop } from "../components/HeroMimoBackdrop";
import { NoteCard } from "../components/NoteCard";
import { SectionHeader } from "../components/SectionHeader";
import { useAppState } from "../state/AppState";
import type { Category, NoteListItem } from "../types";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
  const [categories, setCategories] = React.useState<Category[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([api.notes(), api.categories()])
      .then(([n, c]) => {
        if (cancelled) return;
        setNotes(n.slice(0, 6));
        setCategories(c.slice(0, 6));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const heroVariant: "image" | "mimo" =
    profile?.hero?.variant === "mimo" ? "mimo" : profile?.hero?.imageUrl ? "image" : "mimo";

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

  const heroRef = React.useRef<HTMLElement | null>(null);
  const heroBackdropRef = React.useRef<HTMLDivElement | null>(null);
  const titleSpotRef = React.useRef<HTMLDivElement | null>(null);
  const spotRadius = clamp(profile?.hero?.spotlightRadiusPx ?? 240, 120, 520);
  const rafRef = React.useRef<number | null>(null);
  const lastRef = React.useRef<{ x: number; y: number; tx: number; ty: number; active: boolean }>({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    active: false,
  });

  const flushSpot = React.useCallback(() => {
    rafRef.current = null;
    if (heroVariant !== "mimo") return;
    const backdropEl = heroBackdropRef.current;
    if (!backdropEl) return;
    const { x, y, tx, ty, active } = lastRef.current;
    backdropEl.style.setProperty("--hb-spot-x", `${x}px`);
    backdropEl.style.setProperty("--hb-spot-y", `${y}px`);
    backdropEl.style.setProperty("--hb-spot-r", active ? `${spotRadius}px` : "0px");

    const titleEl = titleSpotRef.current;
    if (titleEl) {
      titleEl.style.setProperty("--hb-spot-x", `${tx}px`);
      titleEl.style.setProperty("--hb-spot-y", `${ty}px`);
      titleEl.style.setProperty("--hb-spot-r", active ? `${spotRadius}px` : "0px");
    }
  }, [heroVariant, spotRadius]);

  const scheduleFlush = React.useCallback(() => {
    if (rafRef.current !== null) return;
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
            <HeroMimoBackdrop patternText={profile?.hero?.patternText ?? profile?.handle ?? profile?.name ?? "HYPERBLOG"} />
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
                  {profile?.name ?? "Hyperblog"}
                </h1>
                <div className="mt-4 font-mono font-medium tracking-[-0.02em] text-[hsl(var(--accent))]" style={{ fontSize: heroHandleSize }}>
                  {profile?.handle ?? "@you"}
                </div>
                <p
                  className="mt-5 mx-auto max-w-[64ch] leading-relaxed tracking-[-0.01em]"
                  style={{
                    color: heroVariant === "mimo" ? "hsl(var(--muted))" : heroFg,
                    opacity: heroVariant === "mimo" ? 0.92 : 0.82,
                    fontSize: heroTaglineSize,
                  }}
                >
                  {profile?.tagline ?? "把 Notes、Categories 与 Roadmaps 三套入口合一：可读、可索引、可证明。"}
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
                      {profile?.name ?? "Hyperblog"}
                    </h1>
                    <div
                      className="mt-4 font-mono font-medium tracking-[-0.02em] text-[hsl(var(--accent))]"
                      style={{ fontSize: heroHandleSize }}
                    >
                      {profile?.handle ?? "@you"}
                    </div>
                    <p
                      className="mt-5 mx-auto max-w-[64ch] leading-relaxed tracking-[-0.01em]"
                      style={{ color: "color-mix(in oklab, hsl(var(--bg)) 86%, transparent)", fontSize: heroTaglineSize }}
                    >
                      {profile?.tagline ?? "把 Notes、Categories 与 Roadmaps 三套入口合一：可读、可索引、可证明。"}
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
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.id} to={`/categories/${c.id}`} className="group card p-5 transition-colors hover:bg-[hsl(var(--card2))]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold tracking-tight">{c.title}</div>
                  <div className="mt-2 text-sm text-[hsl(var(--muted))]">{c.description ?? "作为传统目录入口"}</div>
                </div>
                <ArrowUpRight className="mt-1 h-4 w-4 opacity-50 transition group-hover:opacity-80" />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Chip label={`${c.noteCount ?? 0} notes`} tone="glass" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
