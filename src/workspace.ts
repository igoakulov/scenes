import { mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKebabCaseId(id: string): boolean {
  return KEBAB_CASE.test(id);
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

/**
 * Immediate child directories of scenes/ (candidate scene ids).
 * Missing scenes/ → [] (callers that care about layout use hasScenesDir).
 */
export async function listSceneIds(workspace: string): Promise<string[]> {
  const dir = scenesDir(workspace);
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
    if (ent.name.startsWith(".")) continue;
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
