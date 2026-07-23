import * as THREE from "three";
import { defaultsFromParamsTree, type ParamValue } from "./defaults";

export interface SceneMetadata {
  title: string;
  description: string;
  tags: string[];
  dimensions: 2 | 3;
  attribution?: Record<string, unknown>;
}

export interface LoadedScene {
  id: string;
  metadata: SceneMetadata;
  module: SceneModule;
  params: Record<string, ParamValue>;
}

export interface SceneModule {
  setup: (ctx: {
    root: THREE.Object3D;
    params: Record<string, ParamValue>;
    /** Absolute scene folder URL ending in `/` — resolve media with `new URL("assets/…", ctx.baseUrl)`. */
    baseUrl: string;
  }) => void;
  params?: () => unknown;
  onParamsChange?: (
    params: Record<string, ParamValue>,
    change: { key: string; value: ParamValue },
  ) => Record<string, ParamValue>;
  validateParams?: (
    params: Record<string, ParamValue>,
  ) => { message: string; key?: string; cardId?: string }[];
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
  if (typeof module.params === "function") {
    try {
      params = defaultsFromParamsTree(module.params());
    } catch (err) {
      throw new Error(
        `params() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { id, metadata, module, params };
}
