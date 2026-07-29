import * as THREE from "three";
import { defaultsFromParamsTree, type ParamValue } from "./defaults";
import { readParamsTree, type ParamsNode } from "./paramsTree";
import {
  DEFAULT_RUNTIME_FLAGS,
  resolveRuntimeFlags,
  type RuntimeFlags,
} from "./runtimeFlags";

export interface SceneMetadata {
  title: string;
  description: string;
  tags: string[];
  dimensions: 2 | 3;
  attribution?: Record<string, unknown>;
}

export interface SceneHostContext {
  root: THREE.Object3D;
  params: Record<string, ParamValue>;
  /** Absolute scene folder URL ending in `/` — resolve media with `new URL("assets/…", host.baseUrl)`. */
  baseUrl: string;
  /** Host camera — always provided; move it when `runtime.camera === false`. */
  camera: THREE.Camera;
  /** Host WebGL canvas — bind pointer/keys when `runtime.camera === false`. */
  domElement: HTMLCanvasElement;
}

export interface LoadedScene {
  id: string;
  metadata: SceneMetadata;
  module: SceneModule;
  params: Record<string, ParamValue>;
  /** Soft-parsed params() tree for Explore UI (unknown types skipped). */
  paramsTree: ParamsNode[];
  runtime: RuntimeFlags;
}

export interface SceneModule {
  setup: (host: SceneHostContext) => void;
  /** Optional per-frame sim; host owns t/dt and play/pause. */
  update?: (host: SceneHostContext, t: number, dt: number) => void;
  params?: () => unknown;
  onParamsChange?: (
    params: Record<string, ParamValue>,
    change: { key: string; value: ParamValue },
  ) => Record<string, ParamValue>;
  validateParams?: (
    params: Record<string, ParamValue>,
  ) => { message: string; key?: string; cardId?: string }[];
  /** Optional host feature flags; omit or `{}` ⇒ all true. */
  runtime?: unknown;
}

export function sceneBaseUrl(id: string): string {
  return `/ws/scenes/${encodeURIComponent(id)}`;
}

/** Absolute URL of the scene directory (trailing `/`) for resolving relative asset paths. */
export function sceneBaseUrlAbsolute(id: string): string {
  return new URL(`${sceneBaseUrl(id)}/`, window.location.origin).href;
}

export async function loadMetadata(id: string): Promise<SceneMetadata> {
  let res: Response;
  try {
    res = await fetch(`${sceneBaseUrl(id)}/metadata.json`, {
      cache: "no-store",
    });
  } catch {
    throw new Error("failed to fetch metadata.json");
  }
  if (!res.ok) {
    throw new Error(`metadata.json: HTTP ${res.status}`);
  }
  let raw: Record<string, unknown>;
  try {
    raw = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error("metadata.json: invalid JSON");
  }
  if (typeof raw.title !== "string" || typeof raw.description !== "string") {
    throw new Error("metadata.json: missing title/description");
  }
  if (!Array.isArray(raw.tags)) {
    throw new Error("metadata.json: tags want string[]");
  }
  let dimensions: 2 | 3 = 3;
  if (raw.dimensions === 2 || raw.dimensions === 3) {
    dimensions = raw.dimensions;
  }
  return {
    title: raw.title,
    description: raw.description,
    tags: raw.tags as string[],
    dimensions,
    attribution:
      raw.attribution && typeof raw.attribution === "object"
        ? (raw.attribution as Record<string, unknown>)
        : undefined,
  };
}

export async function loadSceneModule(id: string): Promise<SceneModule> {
  const url = `${sceneBaseUrl(id)}/scene.js?t=${Date.now()}`;
  let mod: SceneModule;
  try {
    mod = (await import(/* @vite-ignore */ url)) as SceneModule;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    // Keep a stable phrase for userFacingError; detail is for console.
    console.error("scene.js import failed:", err);
    if (/404|not found|failed to fetch/i.test(detail)) {
      throw new Error("scene.js: HTTP 404");
    }
    throw new Error("Failed to fetch dynamically imported module");
  }
  if (typeof mod.setup !== "function") {
    throw new Error("scene.js: setup want function");
  }
  return mod;
}

export async function loadScene(id: string): Promise<LoadedScene> {
  const [metadata, module] = await Promise.all([
    loadMetadata(id),
    loadSceneModule(id),
  ]);

  let params: Record<string, ParamValue> = {};
  let paramsTree: ParamsNode[] = [];
  if (typeof module.params === "function") {
    try {
      const raw = module.params();
      params = defaultsFromParamsTree(raw);
      paramsTree = readParamsTree(raw);
    } catch (err) {
      throw new Error(
        `params() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  let runtime = { ...DEFAULT_RUNTIME_FLAGS };
  try {
    runtime = resolveRuntimeFlags(module.runtime);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : `runtime: ${String(err)}`,
    );
  }

  return { id, metadata, module, params, paramsTree, runtime };
}

export type { RuntimeFlags };
export { DEFAULT_RUNTIME_FLAGS, resolveRuntimeFlags };
