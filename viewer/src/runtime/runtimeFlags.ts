/** Host feature flags from `export const runtime`. Omitted keys default true. */

export const RUNTIME_FLAG_KEYS = [
  "lights",
  "helpers",
  "camera",
  "playback",
] as const;

export type RuntimeFlagKey = (typeof RUNTIME_FLAG_KEYS)[number];

export type RuntimeFlags = Record<RuntimeFlagKey, boolean>;

export const DEFAULT_RUNTIME_FLAGS: RuntimeFlags = {
  lights: true,
  helpers: true,
  camera: true,
  playback: true,
};

/** Resolve a module export into flags. Invalid shapes throw (viewer soft path may catch). */
export function resolveRuntimeFlags(raw: unknown): RuntimeFlags {
  if (raw === undefined || raw === null) {
    return { ...DEFAULT_RUNTIME_FLAGS };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("runtime: want plain object");
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!(RUNTIME_FLAG_KEYS as readonly string[]).includes(key)) {
      throw new Error(`runtime.${key}: unknown key`);
    }
  }
  const out = { ...DEFAULT_RUNTIME_FLAGS };
  for (const key of RUNTIME_FLAG_KEYS) {
    if (obj[key] === undefined) continue;
    if (typeof obj[key] !== "boolean") {
      throw new Error(`runtime.${key}: want boolean`);
    }
    out[key] = obj[key] as boolean;
  }
  return out;
}
