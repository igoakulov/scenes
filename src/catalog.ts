import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseMetadata } from "./validate/metadata.js";
import { listSceneIds, sceneDir } from "./workspace.js";

/** One row for Library list / GET /api/scenes. */
export interface SceneListEntry {
  id: string;
  /** Present only when metadata.json parses cleanly. */
  title?: string;
}

/**
 * Workspace scene folders with optional titles (same meta bar as `scenes list`).
 * Does not import scene.js. Missing scenes/ → empty array.
 */
export async function listSceneEntries(
  workspace: string,
): Promise<SceneListEntry[]> {
  let ids: string[];
  try {
    ids = await listSceneIds(workspace);
  } catch {
    return [];
  }

  const entries: SceneListEntry[] = [];
  for (const id of ids) {
    const metaPath = join(sceneDir(workspace, id), "metadata.json");
    try {
      const raw = await readFile(metaPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      const { metadata, issues } = parseMetadata(json);
      if (metadata && issues.length === 0) {
        entries.push({ id, title: metadata.title });
      } else {
        entries.push({ id });
      }
    } catch {
      entries.push({ id });
    }
  }
  return entries;
}
