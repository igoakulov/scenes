import { cmdHelp } from "./commands/help.js";
import { cmdInit } from "./commands/init.js";
import { cmdList } from "./commands/list.js";
import { cmdValidate } from "./commands/validate.js";

function parseArgs(argv: string[]): {
  command: string | undefined;
  positionals: string[];
  force: boolean;
} {
  const force = argv.includes("--force");
  const rest = argv.filter((a) => a !== "--force");
  const command = rest[0];
  const positionals = rest.slice(1);
  return { command, positionals, force };
}

async function main(): Promise<number> {
  const { command, positionals, force } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        return await cmdHelp();
      case "init":
        return await cmdInit(positionals[0], force);
      case "list":
        return await cmdList();
      case "validate":
        return await cmdValidate(positionals[0]);
      default:
        console.error(`Unknown command: ${command}`);
        console.error("Run `scenes help` for usage.");
        return 1;
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

const code = await main();
process.exit(code);
