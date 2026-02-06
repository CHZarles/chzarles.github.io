import { Palette } from "lucide-react";
import React from "react";
import { useAppState } from "../state/AppState";

const PRESETS: Array<{ label: string; accent: string }> = [
  { label: "Violet", accent: "270 95% 65%" },
  { label: "Cyan", accent: "190 95% 55%" },
  { label: "Lime", accent: "110 90% 55%" },
  { label: "Amber", accent: "38 95% 58%" },
  { label: "Rose", accent: "350 90% 62%" },
];

export function AccentPicker() {
  const { accent, setAccent } = useAppState();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest?.("[data-accent-picker]")) return;
      setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className="relative" data-accent-picker>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
        aria-label="Accent color"
      >
        <Palette className="h-4 w-4 opacity-90" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_18px_50px_rgba(0,0,0,.10)]">
          <div className="p-2">
            <div className="px-2 py-2 text-xs font-medium text-[hsl(var(--muted))]">Accent</div>
            <div className="grid gap-1">
              {PRESETS.map((p) => {
                const active = p.accent === accent;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setAccent(p.accent);
                      setOpen(false);
                    }}
                    className={[
                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                      active
                        ? "bg-[color-mix(in_oklab,hsl(var(--accent))_12%,hsl(var(--card2)))] text-[hsl(var(--fg))]"
                        : "hover:bg-[hsl(var(--card2))] text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))]",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{
                          background: `hsl(${p.accent})`,
                          boxShadow: `0 0 0 1px hsl(var(--border))`,
                        }}
                      />
                      <span>{p.label}</span>
                    </span>
                    {active ? <span className="text-xs text-[hsl(var(--muted))]">Active</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
