import { readConfig, writeConfig } from "../config.js";
import { printHint, printWorkspace } from "../print.js";
import {
  ensureWorkspaceLayout,
  resolveWorkspacePath,
} from "../workspace.js";

export async function cmdInit(
  pathArg: string | undefined,
  force: boolean,
): Promise<number> {
  const workspace = resolveWorkspacePath(pathArg);

  let current: Awaited<ReturnType<typeof readConfig>>;
  try {
    current = await readConfig();
  } catch (err) {
    if (!force) {
      console.error(err instanceof Error ? err.message : String(err));
      printHint("fix config or: scenes init --force");
      return 1;
    }
    current = null;
  }

  if (current && !force) {
    if (current.workspace === workspace) {
      await ensureWorkspaceLayout(workspace);
      console.log("init ok (exists)");
      printWorkspace(workspace);
      return 0;
    }
    console.error(`workspace set: ${current.workspace}`);
    printHint(`scenes init ${pathArg ?? "."} --force`);
    return 1;
  }

  await ensureWorkspaceLayout(workspace);
  await writeConfig({
    workspace,
    ...(current?.port !== undefined ? { port: current.port } : {}),
  });

  console.log(force && current ? "init ok (reconfigured)" : "init ok");
  printWorkspace(workspace);
  return 0;
}
