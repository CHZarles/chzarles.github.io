import React from "react";

export function EmptyStatePanel(props: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  hint?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_75%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card))_35%,transparent)] p-6 md:p-7">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[color-mix(in_oklab,hsl(var(--border))_70%,transparent)] bg-[color-mix(in_oklab,hsl(var(--card))_60%,transparent)] text-[hsl(var(--fg))]">
              {props.icon}
            </span>
            <div className="min-w-0">
              <div className="font-serif text-xl font-semibold tracking-tight md:text-2xl">{props.title}</div>
              <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">
                {props.desc}
              </p>
              {props.hint ? (
                <div className="mt-3 text-xs font-mono text-[hsl(var(--muted))]">{props.hint}</div>
              ) : null}
            </div>
          </div>
        </div>

        {props.actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{props.actions}</div> : null}
      </div>
    </div>
  );
}
