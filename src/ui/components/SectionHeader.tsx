export function SectionHeader(props: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold tracking-tight md:text-2xl">{props.title}</h2>
          {props.desc ? (
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-[color-mix(in_oklab,hsl(var(--fg))_70%,hsl(var(--muted)))]">
              {props.desc}
            </p>
          ) : null}
        </div>
        {props.right}
      </div>
      <div className="hairline" />
    </div>
  );
}
