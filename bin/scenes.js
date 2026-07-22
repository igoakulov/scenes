#!/usr/bin/env node

import { register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hookUrl = pathToFileURL(join(__dirname, "../dist/three-resolve-hook.js")).href;

register(hookUrl);
await import("../dist/cli.js");
