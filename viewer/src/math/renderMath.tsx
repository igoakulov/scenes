import katex from "katex";
import type { ReactNode } from "react";

/**
 * Render text with $...$ (inline) and $$...$$ (display) math via KaTeX.
 * Escaped \$ is left as literal $.
 */
export function renderMathToHtml(text: string): string {
  if (!text) return "";

  // Display math first
  let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return `$$${tex}$$`;
    }
  });

  // Inline math — skip escaped \$
  out = out.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, (_, tex: string) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return `$${tex}$`;
    }
  });

  out = out.replace(/\\\$/g, "$");
  return out;
}

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}): ReactNode {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMathToHtml(text) }}
    />
  );
}

/** For DOM chips outside React. */
export function fillMathElement(el: HTMLElement, text: string): void {
  el.innerHTML = renderMathToHtml(text);
}
