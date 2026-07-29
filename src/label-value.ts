import type { LabelValue, ParamValue } from "./types.js";

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
