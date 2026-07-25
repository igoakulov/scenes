import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Library-visible id: kebab-case only (no leading dot). */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Scene folder id: optional leading `.` then kebab-case (hidden from Library). */
const SCENE_ID = /^\.?[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Names that are never scene folders (OS / VCS junk under `scenes/`).
 * Compared case-insensitively. Files like `.DS_Store` are already skipped
 * (we only list directories); listed here if they ever appear as dirs.
 */
const IGNORED_SCENE_ENTRIES = new Set(
  [
    ".ds_store",
    ".git",
    ".svn",
    ".hg",
    ".bzr",
    "__macosx",
    "thumbs.db",
    "desktop.ini",
    "node_modules",
    ".spotlight-v100",
    ".trashes",
    ".fseventsd",
    ".temporaryitems",
    ".apdisk",
    ".appledouble",
    ".lsoverride",
    "lost+found",
  ].map((s) => s.toLowerCase()),
);

/** True for visible library ids (`my-scene`). */
export function isKebabCaseId(id: string): boolean {
  return KEBAB_CASE.test(id);
}

/** True for scene folder ids, including hidden (`.my-scene`). */
export function isSceneId(id: string): boolean {
  return SCENE_ID.test(id);
}

export function isHiddenSceneId(id: string): boolean {
  return id.startsWith(".") && SCENE_ID.test(id);
}

/** OS/VCS junk — never treated as a scene id by list. */
export function isIgnoredSceneEntry(name: string): boolean {
  return IGNORED_SCENE_ENTRIES.has(name.toLowerCase());
}

export function scenesDir(workspace: string): string {
  return join(workspace, "scenes");
}

export function sceneDir(workspace: string, id: string): string {
  return join(scenesDir(workspace), id);
}

/** Ensure workspace root has a scenes/ directory. */
export async function ensureWorkspaceLayout(workspace: string): Promise<void> {
  await mkdir(scenesDir(workspace), { recursive: true });
}

/** True when workspace has a `scenes/` directory (may be empty). */
export async function hasScenesDir(workspace: string): Promise<boolean> {
  try {
    const s = await stat(scenesDir(workspace));
    return s.isDirectory();
  } catch {
    return false;
  }
}

export type ListSceneIdsOptions = {
  /**
   * Viewer Library only: omit every `.*` directory.
   * CLI list / validate-all leave this unset so agents discover hidden backups.
   */
  library?: boolean;
};

/**
 * Immediate child directories of scenes/ (candidate scene ids).
 * Missing scenes/ → [] (callers that care about layout use hasScenesDir).
 *
 * Always skips known OS/VCS garbage. Dot-prefixed scene folders are included
 * unless `library: true` (viewer catalog).
 */
export async function listSceneIds(
  workspace: string,
  options?: ListSceneIdsOptions,
): Promise<string[]> {
  const dir = scenesDir(workspace);
  const library = options?.library === true;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const ids: string[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (isIgnoredSceneEntry(ent.name)) continue;
    if (library && ent.name.startsWith(".")) continue;
    ids.push(ent.name);
  }
  ids.sort();
  return ids;
}

export async function sceneExists(
  workspace: string,
  id: string,
): Promise<boolean> {
  try {
    const s = await stat(sceneDir(workspace, id));
    return s.isDirectory();
  } catch {
    return false;
  }
}

export function resolveWorkspacePath(pathArg?: string): string {
  if (pathArg === undefined || pathArg === "") {
    return resolve(process.cwd());
  }
  return resolve(pathArg);
}
