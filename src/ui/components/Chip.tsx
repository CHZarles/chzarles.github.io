import { Link } from "react-router-dom";

export function Chip(props: {
  label: string;
  to?: string;
  tone?: "muted" | "accent" | "glass";
}) {
  const className =
    props.tone === "accent"
      ? "inline-flex items-center rounded-full border border-[color-mix(in_oklab,hsl(var(--accent))_28%,hsl(var(--border)))] bg-transparent px-3 py-1 text-xs text-[hsl(var(--fg))] transition hover:bg-[hsl(var(--card2))]"
      : props.tone === "glass"
        ? "inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs text-[color-mix(in_oklab,hsl(var(--fg))_82%,hsl(var(--muted)))] transition hover:bg-[hsl(var(--card2))] hover:text-[hsl(var(--fg))]"
        : "inline-flex items-center rounded-full border border-transparent bg-transparent px-3 py-1 text-xs text-[hsl(var(--muted))] transition hover:text-[hsl(var(--fg))]";

  if (props.to) {
    return (
      <Link className={className} to={props.to}>
        {props.label}
      </Link>
    );
  }
  return <span className={className}>{props.label}</span>;
}
