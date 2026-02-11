function transformTextSegment(segment: string): string {
  // Support TeX delimiters \( \) and \[ \] in Markdown by converting them to
  // remark-math-compatible $...$ / $$...$$ forms.
  //
  // We only run this on non-code segments (no fences; no inline code spans).
  //
  // Note: Users often write \\( to force a literal backslash in Markdown.
  // We normalize those sequences first (\\( -> \(, same for \\[, \\), \\]).
  const normalized = segment.replace(/\\\\([\(\)\[\]])/g, (_m, ch: string) => `\\${ch}`);

  const inline = normalized.replace(/\\\((.+?)\\\)/g, (_m, inner: string) => {
    const body = inner.trim();
    return body ? `$${body}$` : "$$";
  });

  const display = inline.replace(/\\\[(.+?)\\\]/g, (_m, inner: string) => {
    const body = inner.trim();
    return `$$\n${body}\n$$`;
  });

  return display.replace(/\\\[/g, "$$").replace(/\\\]/g, "$$");
}

function transformLineOutsideInlineCode(line: string): string {
  let out = "";
  let i = 0;
  let textStart = 0;

  while (i < line.length) {
    if (line[i] !== "`") {
      i += 1;
      continue;
    }

    const tickStart = i;
    while (i < line.length && line[i] === "`") i += 1;
    const fence = line.slice(tickStart, i);

    const closeAt = line.indexOf(fence, i);
    if (closeAt === -1) {
      // Unclosed inline code span: treat remaining text as normal.
      break;
    }

    out += transformTextSegment(line.slice(textStart, tickStart));
    out += line.slice(tickStart, closeAt + fence.length);
    i = closeAt + fence.length;
    textStart = i;
  }

  out += transformTextSegment(line.slice(textStart));
  return out;
}

export function normalizeMathDelimiters(markdown: string): string {
  const raw = String(markdown ?? "");
  if (!raw) return raw;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];

  let fence: "```" | "~~~" | null = null;

  for (const line of lines) {
    const s = line.trimEnd();
    const fenceMatch = s.match(/^(```+|~~~+)\s*/);
    if (fenceMatch) {
      const kind = fenceMatch[1].startsWith("~") ? "~~~" : "```";
      fence = fence ? null : kind;
      out.push(line);
      continue;
    }

    if (fence) {
      out.push(line);
      continue;
    }

    out.push(transformLineOutsideInlineCode(line));
  }

  return out.join("\n");
}

