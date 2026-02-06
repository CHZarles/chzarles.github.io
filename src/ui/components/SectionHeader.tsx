export function SectionHeader(props: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-lg font-semibold tracking-tight">{props.title}</h2>
        {props.desc ? <p className="mt-1 text-sm text-[hsl(var(--muted))]">{props.desc}</p> : null}
      </div>
      {props.right}
    </div>
  );
}
