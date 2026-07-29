import type { LabelValue, ParamValue } from "./types.js";

/** Resolve a label for display (string as-is; function called with flat params). */
export function resolveLabelValue(
  value: LabelValue,
  params: Record<string, ParamValue>,
): string {
  if (typeof value === "function") {
    try {
      const out = value(params);
      return typeof out === "string" ? out : String(out);
    } catch (err) {
      return `(error: ${err instanceof Error ? err.message : String(err)})`;
    }
  }
  return value;
}
