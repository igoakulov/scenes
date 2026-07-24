/**
 * Soft-read of scene params() for Explore UI.
 * Unknown types are skipped (CLI rejects them; viewer stays resilient).
 */

import type { ParamValue } from "./defaults";

export type LabelValue =
  | string
  | ((params: Record<string, ParamValue>) => string);

export interface NumberNode {
  type: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  unit?: string;
}

export interface BooleanNode {
  type: "boolean";
  key: string;
  label: string;
  default: boolean;
}

export interface SelectNode {
  type: "select";
  key: string;
  label: string;
  options: string[];
  default: string;
}

export interface MultiselectNode {
  type: "multiselect";
  key: string;
  label: string;
  options: string[];
  default: string[];
}

export interface StringNode {
  type: "string";
  key: string;
  label: string;
  default: string;
  placeholder?: string;
}

export interface NoteNode {
  type: "note";
  text: string;
}

export interface LabelNode {
  type: "label";
  label: string;
  value: LabelValue;
}

export interface CardNode {
  type: "card";
  title: string;
  id?: string;
  children: ParamsNode[];
}

export type ParamsNode =
  | CardNode
  | NoteNode
  | LabelNode
  | NumberNode
  | BooleanNode
  | SelectNode
  | MultiselectNode
  | StringNode;

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

/** Soft-parse params() return; skip unknown / incomplete nodes. */
export function readParamsTree(raw: unknown): ParamsNode[] {
  if (!Array.isArray(raw)) return [];
  const out: ParamsNode[] = [];
  for (const item of raw) {
    const n = readNode(item);
    if (n) out.push(n);
  }
  return out;
}

function readNode(raw: unknown): ParamsNode | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string") return undefined;

  switch (type) {
    case "card":
      return readCard(o);
    case "note":
      if (typeof o.text !== "string" || !o.text.trim()) return undefined;
      return { type: "note", text: o.text };
    case "label":
      if (typeof o.label !== "string" || !o.label.trim()) return undefined;
      if (typeof o.value !== "string" && typeof o.value !== "function") {
        return undefined;
      }
      return {
        type: "label",
        label: o.label,
        value: o.value as LabelValue,
      };
    case "number":
      return readNumber(o);
    case "boolean":
      return readBoolean(o);
    case "select":
      return readSelect(o);
    case "multiselect":
      return readMultiselect(o);
    case "string":
      return readString(o);
    default:
      // Soft-skip hallucinated types
      return undefined;
  }
}

function readCard(o: Record<string, unknown>): CardNode | undefined {
  if (typeof o.title !== "string" || !o.title.trim()) return undefined;
  const children: ParamsNode[] = [];
  if (Array.isArray(o.children)) {
    for (const c of o.children) {
      const n = readNode(c);
      if (n) children.push(n);
    }
  }
  const card: CardNode = { type: "card", title: o.title, children };
  if (typeof o.id === "string" && o.id.trim()) card.id = o.id;
  return card;
}

function readNumber(o: Record<string, unknown>): NumberNode | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.min !== "number" || !Number.isFinite(o.min)) return undefined;
  if (typeof o.max !== "number" || !Number.isFinite(o.max)) return undefined;
  if (typeof o.default !== "number" || !Number.isFinite(o.default)) {
    return undefined;
  }
  const node: NumberNode = {
    type: "number",
    key: o.key,
    label: o.label,
    min: o.min,
    max: o.max,
    default: o.default,
  };
  if (typeof o.step === "number" && o.step > 0) node.step = o.step;
  if (typeof o.unit === "string") node.unit = o.unit;
  return node;
}

function readBoolean(o: Record<string, unknown>): BooleanNode | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.default !== "boolean") return undefined;
  return {
    type: "boolean",
    key: o.key,
    label: o.label,
    default: o.default,
  };
}

function readSelect(o: Record<string, unknown>): SelectNode | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (!Array.isArray(o.options) || o.options.length === 0) return undefined;
  const options = o.options.filter((x): x is string => typeof x === "string");
  if (options.length === 0) return undefined;
  if (typeof o.default !== "string") return undefined;
  return {
    type: "select",
    key: o.key,
    label: o.label,
    options,
    default: o.default,
  };
}

function readMultiselect(
  o: Record<string, unknown>,
): MultiselectNode | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (!Array.isArray(o.options) || o.options.length === 0) return undefined;
  const options = o.options.filter((x): x is string => typeof x === "string");
  if (options.length === 0) return undefined;
  if (!Array.isArray(o.default)) return undefined;
  const def = o.default.filter((x): x is string => typeof x === "string");
  return {
    type: "multiselect",
    key: o.key,
    label: o.label,
    options,
    default: def,
  };
}

function readString(o: Record<string, unknown>): StringNode | undefined {
  if (typeof o.key !== "string" || !o.key) return undefined;
  if (typeof o.label !== "string") return undefined;
  if (typeof o.default !== "string") return undefined;
  const node: StringNode = {
    type: "string",
    key: o.key,
    label: o.label,
    default: o.default,
  };
  if (typeof o.placeholder === "string") node.placeholder = o.placeholder;
  return node;
}
