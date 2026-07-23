import { readConfig } from "../config.js";
import {
  printWorkspace,
  printWorkspaceErr,
  printWorkspaceNone,
} from "../print.js";

export async function cmdHelp(): Promise<number> {
  console.log(`scenes — agent-authored Three.js scenes

cmds:
  init [path] [--force]  set workspace (path|cwd)
  list                   scenes (meta only)
  validate [id]          one or all
  show [id]              serve viewer (validate gate if id); Ctrl+C stop
  help

layout: <workspace>/scenes/<id>/{metadata.json,scene.js,assets?/}
config: ~/.config/scenes/config.json  (win: %APPDATA%\\scenes\\)
meta: title, description, tags[]; optional dimensions 2|3 (default 3)

output (see docs/shell.md):
  workspace <abs>
  @ scenes/<id>
  - …          list: title | ERR; validate/show: ok | path: msg
  listen <url>           show ready (opens browser)
`);

  try {
    const config = await readConfig();
    if (config) printWorkspace(config.workspace);
    else printWorkspaceNone();
  } catch (err) {
    printWorkspaceErr(err instanceof Error ? err.message : String(err));
  }
  return 0;
}
