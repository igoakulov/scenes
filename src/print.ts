import { relative } from "node:path";
import { sceneDir } from "./workspace.js";

/** Absolute workspace root (once per command that reports scenes). */
export function printWorkspace(workspace: string): void {
  console.log(`workspace ${workspace}`);
}

/** Help / cold-start: no config yet. */
export function printWorkspaceNone(): void {
  console.log("workspace (none — run scenes init)");
}

/** Help: config unreadable. */
export function printWorkspaceErr(message: string): void {
  console.log(`workspace ERR ${message}`);
}

/**
 * One scene block — same shape for list, validate, show gate.
 *   @ scenes/<id>
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

/** stderr: hint: <msg> */
export function printHint(msg: string): void {
  console.error(`hint: ${msg}`);
}

/** stderr: fail <failed>/<total> */
export function printFail(failed: number, total: number): void {
  console.error(`fail ${failed}/${total}`);
}

/** stdout: listen <url> — show server (and similar). */
export function printListen(url: string): void {
  console.log(`listen ${url}`);
}
