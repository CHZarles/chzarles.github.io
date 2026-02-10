import React from "react";

export function EmptyStatePanel(props: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card2))_55%,transparent)] p-8">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[color-mix(in_oklab,hsl(var(--accent))_18%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-[color-mix(in_oklab,hsl(var(--fg))_10%,transparent)] blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card))_70%,transparent)] text-[hsl(var(--fg))]">
              {props.icon}
            </span>
            <div className="min-w-0">
              <div className="font-serif text-xl font-semibold tracking-tight md:text-2xl">{props.title}</div>
              <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">
                {props.desc}
              </p>
              {props.hint ? (
                <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-[color-mix(in_oklab,hsl(var(--border))_75%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card))_65%,transparent)] px-3 py-1 text-xs font-mono text-[color-mix(in_oklab,hsl(var(--fg))_78%,hsl(var(--muted)))]">
                  {props.hint}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {props.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{props.actions}</div> : null}
      </div>
    </div>
  );
}

