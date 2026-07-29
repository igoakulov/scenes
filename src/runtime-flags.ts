/** Host feature flags from `export const runtime`. Shared by CLI validate + viewer. */

export const RUNTIME_FLAG_KEYS = [
  "lights",
  "helpers",
  "camera",
  "playback",
] as const;

export type RuntimeFlagKey = (typeof RUNTIME_FLAG_KEYS)[number];

export type RuntimeFlags = Record<RuntimeFlagKey, boolean>;

export const DEFAULT_RUNTIME_FLAGS: RuntimeFlags = {
  lights: true,
  helpers: true,
  camera: true,
  playback: true,
};

const KEY_SET = new Set<string>(RUNTIME_FLAG_KEYS);

export type RuntimeFlagIssue = { path: string; message: string };

/**
 * Soft-check for CLI validate. Omitted export is OK; null / non-object / bad keys fail.
 * Paths use `scene.runtime…` (validate dialect).
 */
export function issuesForRuntimeExport(raw: unknown): RuntimeFlagIssue[] {
  if (raw === undefined) return [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ path: "scene.runtime", message: "want plain object" }];
  }
  const issues: RuntimeFlagIssue[] = [];
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!KEY_SET.has(key)) {
      issues.push({ path: `scene.runtime.${key}`, message: "unknown key" });
      continue;
    }
    if (typeof obj[key] !== "boolean") {
      issues.push({ path: `scene.runtime.${key}`, message: "want boolean" });
    }
  }
  return issues;
}

/** Hard-resolve for the viewer load path. Invalid shapes throw (unlike soft CLI issues). */
export function resolveRuntimeFlags(raw: unknown): RuntimeFlags {
  const issues = issuesForRuntimeExport(raw);
  if (issues.length > 0) {
    const first = issues[0]!;
    // Match viewerError patterns: `runtime: …` / `runtime.<key>: …`
    const msg =
      first.path === "scene.runtime"
        ? `runtime: ${first.message}`
        : first.path.replace(/^scene\./, "") + `: ${first.message}`;
    throw new Error(msg);
  }
  if (raw === undefined) {
    return { ...DEFAULT_RUNTIME_FLAGS };
  }
  const obj = raw as Record<string, unknown>;
  const out = { ...DEFAULT_RUNTIME_FLAGS };
  for (const key of RUNTIME_FLAG_KEYS) {
    if (obj[key] === undefined) continue;
    out[key] = obj[key] as boolean;
  }
  return out;
}
