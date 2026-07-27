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
  /** Resolved host feature flags (defaults all true). */
  runtime: RuntimeFlags;
}

export interface SceneModule {
  setup: (host: SceneHostContext) => void;
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
  const res = await fetch(`${sceneBaseUrl(id)}/metadata.json`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`metadata.json: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as Record<string, unknown>;
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
  const mod = (await import(/* @vite-ignore */ url)) as SceneModule;
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
