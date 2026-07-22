/**
 * Resolve bare `three` imports from workspace scenes to this npm package's dependency.
 * Registered from bin/scenes.js before the CLI loads scene modules.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { ResolveHook } from "node:module";

const require = createRequire(import.meta.url);
const threeUrl = pathToFileURL(require.resolve("three")).href;

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  if (specifier === "three") {
    return {
      shortCircuit: true,
      url: threeUrl,
    };
  }
  return nextResolve(specifier, context);
};
