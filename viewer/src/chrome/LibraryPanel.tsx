import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SceneListEntry {
  id: string;
  title?: string;
}

/** Placeholder until skill package URL is final (step 4 / publish). */
const SCENES_SKILL_URL = "https://github.com/igoakulov/scenes"; // TODO: skill install URL

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

function SectionHeading({
  id,
  children,
}: {
  id?: string;
  children: string;
}) {
  // base-mira SidebarGroupLabel: text-xs muted, sentence case (no uppercase).
  return (
    <h2
      id={id}
      className="m-0 px-2 text-xs font-normal text-muted-foreground"
    >
      {children}
    </h2>
  );
}

export function LibraryPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [entries, setEntries] = useState<SceneListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const list = await fetchSceneList();
        if (!cancelled) setEntries(list);
      } catch (err) {
        if (!cancelled) {
          setEntries(null);
          setError(err instanceof Error ? err.message : String(err));
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
      <p className="m-0 px-2 text-xs text-muted-foreground">
        Could not load library.
      </p>
    );
  } else if (entries === null) {
    body = (
      <p className="m-0 px-2 text-xs text-muted-foreground">Loading…</p>
    );
  } else if (entries.length === 0) {
    body = (
      <p className="m-0 px-2 text-xs/relaxed text-muted-foreground">
        Ask your AI agent to create your first scene with{" "}
        <a
          href={SCENES_SKILL_URL}
          className="text-foreground underline underline-offset-4 hover:text-primary"
          target="_blank"
          rel="noreferrer"
        >
          scenes-skill
        </a>
        .
      </p>
    );
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
                  // Density matches base-mira DropdownMenuItem / SidebarMenu sm: text-xs, min-h-7.
                  "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed",
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
    <div className="flex flex-col gap-4">
      {/* Later: Collections section — same SectionHeading pattern */}
      <section
        className="flex flex-col gap-1.5"
        aria-labelledby="library-scenes-heading"
      >
        <SectionHeading id="library-scenes-heading">Scenes</SectionHeading>
        {body}
      </section>
    </div>
  );
}
