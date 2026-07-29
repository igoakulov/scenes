import { useCallback, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { SceneMetadata } from "../runtime/loadScene";
import { DescriptionText } from "../math/renderDescription.tsx";
import { Button } from "@/components/ui/button";

/** Copy control pastes `id: "title"` for agent reference. */
export function SummaryPanel({
  id,
  metadata,
}: {
  id: string;
  metadata: SceneMetadata;
}) {
  const [copied, setCopied] = useState(false);
  const copyText = `${id}: "${metadata.title}"`;

  const copyRef = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [copyText]);

  const attributionRows = metadata.attribution
    ? Object.entries(metadata.attribution).filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === "string" && Boolean(entry[1]),
      )
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-2.5 text-xs/relaxed">
      <div className="flex min-w-0 items-center gap-1">
        <h1
          className="min-w-0 flex-1 truncate text-sm font-medium tracking-tight"
          title={metadata.title}
        >
          {metadata.title}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          title={copied ? "Copied" : `Copy “${copyText}”`}
          aria-label={copied ? "Copied" : "Copy scene id and title"}
          onClick={() => void copyRef()}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
        </Button>
      </div>
      <DescriptionText
        text={metadata.description}
        className="text-muted-foreground [&_.katex]:text-foreground"
      />
      {metadata.tags.length > 0 && (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {metadata.tags.map((t) => (
            <span
              key={t}
              title={t}
              className="max-w-full truncate rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {attributionRows.length > 0 && (
        <section className="flex min-w-0 flex-col gap-1">
          <p className="m-0 text-xs font-normal text-muted-foreground">
            Attribution
          </p>
          <ul className="m-0 flex list-disc flex-col gap-0.5 pl-4">
            {attributionRows.map(([key, value]) => (
              <li
                key={key}
                className="sheet-selectable m-0 min-w-0 break-words text-xs/relaxed text-muted-foreground [overflow-wrap:anywhere]"
              >
                {key}: {value}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
