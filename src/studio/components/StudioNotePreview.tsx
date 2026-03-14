import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { normalizeMathDelimiters } from "../../ui/markdown/normalizeMathDelimiters";

export const StudioNotePreview = React.memo(function StudioNotePreview(props: { content: string }) {
  const normalized = React.useMemo(() => normalizeMathDelimiters(props.content || ""), [props.content]);

  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalized}
      </ReactMarkdown>
    </div>
  );
});
