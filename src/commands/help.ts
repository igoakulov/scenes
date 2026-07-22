import { readConfig } from "../config.js";
import { printWorkspace } from "../print.js";

export async function cmdHelp(): Promise<number> {
  console.log(`scenes — agent-authored Three.js scenes

cmds:
  init [path] [--force]  set workspace (path|cwd)
  list                   scenes (meta only)
  validate [id]          one or all
  help

layout: <workspace>/scenes/<id>/{metadata.json,scene.js,assets?/}
config: ~/.config/scenes/config.json  (win: %APPDATA%\\scenes\\)
meta: title, description, tags[]; optional dimensions 2|3 (default 3)

output (list + validate):
  workspace <abs>
  @ scenes/<id>
  - …          list: title | ERR; validate: ok | path: msg
`);

  try {
    const config = await readConfig();
    if (config) printWorkspace(config.workspace);
    else console.log("workspace (none — run scenes init)");
  } catch (err) {
    console.log(
      `workspace ERR ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return 0;
}
