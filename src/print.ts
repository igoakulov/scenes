import { relative } from "node:path";
import { sceneDir } from "./workspace.js";

/** Absolute workspace root (once per command that reports scenes). */
export function printWorkspace(workspace: string): void {
  console.log(`workspace ${workspace}`);
}

/**
 * One scene block — same shape for list and validate.
 *   @ scenes/<id>
 *   - detail
 *   - detail
 */
export function printSceneBlock(
  workspace: string,
  id: string,
  lines: string[],
): void {
  const rel = relative(workspace, sceneDir(workspace, id)) || `scenes/${id}`;
  console.log(`@ ${rel}`);
  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

export function formatIssueLines(
  issues: { path: string; message: string }[],
): string[] {
  return issues.map((i) => `${i.path}: ${i.message}`);
}
