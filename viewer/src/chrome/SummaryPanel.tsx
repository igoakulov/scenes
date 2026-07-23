import type { SceneMetadata } from "../runtime/loadScene";
import { MathText } from "../math/renderMath";

export function SummaryPanel({ metadata }: { metadata: SceneMetadata }) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-base font-semibold tracking-tight">{metadata.title}</h1>
      <MathText
        text={metadata.description}
        className="text-sm leading-relaxed text-muted-foreground [&_.katex]:text-foreground"
      />
      {metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {metadata.tags.map((t) => (
            <span
              key={t}
              className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {metadata.attribution && (
        <section className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Attribution
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            {Object.entries(metadata.attribution)
              .filter(([, v]) => typeof v === "string" && v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </p>
        </section>
      )}
    </div>
  );
}
