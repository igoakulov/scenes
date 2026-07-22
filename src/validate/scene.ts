import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import type { SceneValidationResult, ValidationIssue } from "../types.js";
import { isKebabCaseId, sceneDir } from "../workspace.js";
import { parseMetadata } from "./metadata.js";
import {
  defaultsFromFields,
  validateParamFields,
  validateParamsResult,
} from "./params.js";

export async function validateScene(
  workspace: string,
  id: string,
): Promise<SceneValidationResult> {
  const issues: ValidationIssue[] = [];
  const dir = sceneDir(workspace, id);

  if (!isKebabCaseId(id)) {
    issues.push({
      path: "id",
      message: "want kebab-case (e.g. my-scene)",
    });
  }

  const metadataPath = join(dir, "metadata.json");
  const scenePath = join(dir, "scene.js");

  let metadataRaw: string | undefined;
  try {
    metadataRaw = await readFile(metadataPath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      issues.push({ path: "meta", message: "missing metadata.json" });
    } else {
      issues.push({ path: "meta", message: String(err) });
    }
  }

  if (metadataRaw !== undefined) {
    let json: unknown;
    try {
      json = JSON.parse(metadataRaw);
    } catch {
      issues.push({ path: "meta", message: "invalid JSON" });
      json = undefined;
    }
    if (json !== undefined) {
      const { issues: metaIssues } = parseMetadata(json);
      issues.push(...metaIssues);
    }
  }

  let sceneExists = true;
  try {
    await readFile(scenePath, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      sceneExists = false;
      issues.push({ path: "scene", message: "missing scene.js" });
    } else {
      sceneExists = false;
      issues.push({ path: "scene", message: String(err) });
    }
  }

  if (sceneExists) {
    issues.push(...(await validateSceneModule(scenePath)));
  }

  return { id, ok: issues.length === 0, issues };
}

async function validateSceneModule(scenePath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const url = `${pathToFileURL(scenePath).href}?t=${Date.now()}`;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(url)) as Record<string, unknown>;
  } catch (err) {
    issues.push({
      path: "scene",
      message: `import failed: ${err instanceof Error ? err.message : String(err)}`,
    });
    return issues;
  }

  if (typeof mod.setup !== "function") {
    issues.push({ path: "scene.setup", message: "want function" });
  }

  if (mod.onParamsChange !== undefined && typeof mod.onParamsChange !== "function") {
    issues.push({ path: "scene.onParamsChange", message: "want function" });
  }

  if (mod.validateParams !== undefined && typeof mod.validateParams !== "function") {
    issues.push({ path: "scene.validateParams", message: "want function" });
  }

  if (mod.params === undefined) {
    return issues;
  }

  if (typeof mod.params !== "function") {
    issues.push({ path: "scene.params", message: "want function" });
    return issues;
  }

  let fieldsRaw: unknown;
  try {
    fieldsRaw = (mod.params as () => unknown)();
  } catch (err) {
    issues.push({
      path: "scene.params",
      message: `threw: ${err instanceof Error ? err.message : String(err)}`,
    });
    return issues;
  }

  const { fields, issues: fieldIssues } = validateParamFields(
    fieldsRaw,
    "params",
  );
  issues.push(...fieldIssues);
  if (!fields) return issues;

  if (typeof mod.validateParams === "function") {
    const defaults = defaultsFromFields(fields);
    let result: unknown;
    try {
      result = (mod.validateParams as (p: unknown) => unknown)(defaults);
    } catch (err) {
      issues.push({
        path: "scene.validateParams",
        message: `threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      return issues;
    }
    issues.push(...validateParamsResult(result, "params.check"));
  }

  return issues;
}
