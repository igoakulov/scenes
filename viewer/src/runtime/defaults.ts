export type ParamValue = number | boolean | string;

/** Flat defaults from a params() tree (writable fields only). */
export function defaultsFromParamsTree(
  raw: unknown,
): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  walk(raw, out);
  return out;
}

function walk(node: unknown, out: Record<string, ParamValue>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const type = o.type;

  if (type === "card" && Array.isArray(o.children)) {
    walk(o.children, out);
    return;
  }

  if (
    (type === "number" || type === "boolean" || type === "select") &&
    typeof o.key === "string" &&
    o.key.length > 0 &&
    o.default !== undefined
  ) {
    out[o.key] = o.default as ParamValue;
  }
}
