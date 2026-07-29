import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { userFacingError } from "../runtime/viewerError";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SceneListEntry {
  id: string;
  title?: string;
}

type ExamplePrompt = {
  id: string;
  title: string;
  body: string;
};

const SCENIE_SKILL_URL =
  "https://github.com/igoakulov/scenie/blob/main/skills/scenie/SKILL.md";

const SKILL_INSTALL_CMD =
  "npx skills add igoakulov/scenie --skill scenie -g -y";

const INIT_CMD = "scenie init";

async function fetchSceneList(): Promise<SceneListEntry[]> {
  const res = await fetch("/api/scenes", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("want array");
  }
  return data.filter(
    (row): row is SceneListEntry =>
      row !== null &&
      typeof row === "object" &&
      typeof (row as SceneListEntry).id === "string" &&
      (row as SceneListEntry).id.length > 0,
  );
}

async function fetchExamplePrompts(): Promise<ExamplePrompt[]> {
  const res = await fetch("/api/example-prompts", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(
    (row): row is ExamplePrompt =>
      row !== null &&
      typeof row === "object" &&
      typeof (row as ExamplePrompt).id === "string" &&
      typeof (row as ExamplePrompt).title === "string" &&
      typeof (row as ExamplePrompt).body === "string" &&
      (row as ExamplePrompt).body.length > 0,
  );
}

function SectionHeading({
  id,
  children,
}: {
  id?: string;
  children: string;
}) {
  return (
    <h2
      id={id}
      className="m-0 px-2 text-xs font-normal text-muted-foreground"
    >
      {children}
    </h2>
  );
}

function useCopyText(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [text]);
  return { copied, copy };
}

/** Flat command + copy — setup actions, not scene prompts. */
function CommandRow({
  command,
  copyLabel,
}: {
  command: string;
  copyLabel: string;
}) {
  const { copied, copy } = useCopyText(command);

  return (
    <div className="flex min-w-0 items-start gap-1 px-0.5">
      <code className="sheet-selectable m-0 min-w-0 flex-1 wrap-anywhere font-mono text-xs/relaxed text-foreground">
        {command}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground"
        title={copied ? "Copied" : copyLabel}
        aria-label={copied ? "Copied" : copyLabel}
        onClick={() => void copy()}
      >
        {copied ? (
          <CheckIcon data-icon="inline-start" />
        ) : (
          <CopyIcon data-icon="inline-start" />
        )}
      </Button>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: ExamplePrompt }) {
  const { copied, copy } = useCopyText(prompt.body);

  return (
    <div className="min-w-0 rounded-md border border-border px-2 py-1.5">
      <div className="flex min-w-0 items-start gap-1">
        <p className="m-0 min-w-0 flex-1 text-xs font-medium text-foreground">
          {prompt.title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          title={copied ? "Copied" : "Copy prompt"}
          aria-label={copied ? "Copied" : `Copy prompt: ${prompt.title}`}
          onClick={() => void copy()}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
        </Button>
      </div>
      <pre className="sheet-selectable m-0 mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap wrap-anywhere font-sans text-xs/relaxed text-muted-foreground">
        {prompt.body}
      </pre>
    </div>
  );
}

function EmptyLibrary({ prompts }: { prompts: ExamplePrompt[] | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="sheet-selectable m-0 text-xs/relaxed text-muted-foreground">
          Ask your AI agent to run this command to install the{" "}
          <a
            href={SCENIE_SKILL_URL}
            className="text-foreground/90 hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Scenie skill
          </a>
          :
        </p>
        <CommandRow
          command={SKILL_INSTALL_CMD}
          copyLabel="Copy skill install command"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="sheet-selectable m-0 text-xs/relaxed text-muted-foreground">
          Add example scenes to library — ask AI agent to run:
        </p>
        <CommandRow command={INIT_CMD} copyLabel="Copy scenie init command" />
      </div>

      {prompts && prompts.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          <p className="sheet-selectable m-0 text-xs/relaxed text-muted-foreground">
            Or ask your agent to make a new scene:
          </p>
          {prompts.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [entries, setEntries] = useState<SceneListEntry[] | null>(null);
  const [prompts, setPrompts] = useState<ExamplePrompt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const list = await fetchSceneList();
        if (cancelled) return;
        setEntries(list);
        if (list.length === 0) {
          try {
            const p = await fetchExamplePrompts();
            if (!cancelled) setPrompts(p);
          } catch {
            if (!cancelled) setPrompts([]);
          }
        } else if (!cancelled) {
          setPrompts(null);
        }
      } catch (err) {
        if (!cancelled) {
          setEntries(null);
          setError(userFacingError(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  let body: ReactNode;
  if (error) {
    body = (
      <p
        className="sheet-selectable m-0 px-2 text-xs text-muted-foreground"
        title={error}
      >
        {error}
      </p>
    );
  } else if (entries === null) {
    body = (
      <p className="m-0 px-2 text-xs text-muted-foreground">Loading…</p>
    );
  } else if (entries.length === 0) {
    body = <EmptyLibrary prompts={prompts} />;
  } else {
    body = (
      <ul className="m-0 flex list-none flex-col gap-px p-0">
        {entries.map((entry) => {
          const label = entry.title?.trim() || entry.id;
          return (
            <li key={entry.id}>
              <button
                type="button"
                title={label}
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed",
                  "text-foreground hover:bg-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                onClick={() => onOpen(entry.id)}
              >
                <span
                  aria-hidden
                  className="size-1 shrink-0 rounded-full bg-muted-foreground/70"
                />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section
        className="flex min-w-0 flex-col gap-1.5"
        aria-labelledby="library-scenes-heading"
      >
        <SectionHeading id="library-scenes-heading">Scenes</SectionHeading>
        {body}
      </section>
    </div>
  );
}
