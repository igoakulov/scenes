import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireWorkspace } from "../config.js";
import { printSceneBlock, printWorkspace } from "../print.js";
import { parseMetadata } from "../validate/metadata.js";
import { listSceneIds, sceneDir } from "../workspace.js";

/** id → title (or ERR). Tags/dimensions: read metadata.json when needed. */
export async function cmdList(): Promise<number> {
  const workspace = await requireWorkspace();
  printWorkspace(workspace);

  const ids = await listSceneIds(workspace);
  if (ids.length === 0) {
    return 0;
  }

  let hadWarning = false;
  for (const id of ids) {
    const metaPath = join(sceneDir(workspace, id), "metadata.json");
    try {
      const raw = await readFile(metaPath, "utf8");
      const json = JSON.parse(raw) as unknown;
      const { metadata, issues } = parseMetadata(json);
      if (!metadata || issues.length > 0) {
        hadWarning = true;
        printSceneBlock(workspace, id, [
          `ERR ${issues.map((i) => i.path).join(",") || "meta"}`,
        ]);
        continue;
      }
      printSceneBlock(workspace, id, [metadata.title]);
    } catch {
      hadWarning = true;
      printSceneBlock(workspace, id, ["ERR meta"]);
    }
  }

  if (hadWarning) {
    console.error("hint: scenes validate");
  }
  return 0;
}
