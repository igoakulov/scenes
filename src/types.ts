/** Spatial dimensions for camera/runtime. Default 3 when omitted. */
export type SceneDimensions = 2 | 3;

export interface SceneAttribution {
  model?: string;
  author?: string;
  [key: string]: unknown;
}

export interface SceneMetadata {
  title: string;
  description: string;
  tags: string[];
  /** Always set after parse (default 3). */
  dimensions: SceneDimensions;
  attribution?: SceneAttribution;
  [key: string]: unknown;
}

/** Writable control types — values land in flat `host.params[key]`. */
export type WritableParamType =
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "string";

/** Exact allowed params() node types (CLI + skill). No aliases. */
export const PARAM_NODE_TYPES = [
  "card",
  "note",
  "label",
  "number",
  "boolean",
  "select",
  "multiselect",
  "string",
] as const;

export type ParamNodeType = (typeof PARAM_NODE_TYPES)[number];

export interface NumberParamField {
  type: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
  /** Optional display unit (e.g. "m", "°", "AU") — not part of host.params. */
  unit?: string;
}

export interface BooleanParamField {
  type: "boolean";
  key: string;
  label: string;
  default: boolean;
}

export interface SelectParamField {
  type: "select";
  key: string;
  label: string;
  options: string[];
  default: string;
}

export interface MultiselectParamField {
  type: "multiselect";
  key: string;
  label: string;
  options: string[];
  default: string[];
}

export interface StringParamField {
  type: "string";
  key: string;
  label: string;
  default: string;
  /** In-input format hint (not a separate hint field). */
  placeholder?: string;
}

export type WritableParamField =
  | NumberParamField
  | BooleanParamField
  | SelectParamField
  | MultiselectParamField
  | StringParamField;

/** @deprecated Use WritableParamField — kept as alias during transition. */
export type ParamField = WritableParamField;

/** Flat bag values: scalars + multiselect string[]. */
export type ParamValue = number | boolean | string | string[];

export interface NoteParamNode {
  type: "note";
  text: string;
}

/**
 * Read-only row. `value` is a fixed string, or a pure function of the flat
 * params bag (recomputed when controls change — e.g. derived angles/sides).
 */
export type LabelValue =
  | string
  | ((params: Record<string, ParamValue>) => string);

export interface LabelParamNode {
  type: "label";
  label: string;
  value: LabelValue;
}

export interface ParamCard {
  type: "card";
  title: string;
  id?: string;
  children: ParamsNode[];
}

/** Ordered node in `params()` tree (root array or card.children). */
export type ParamsNode =
  | ParamCard
  | WritableParamField
  | NoteParamNode
  | LabelParamNode;

export interface ParamValidationIssue {
  message: string;
  key?: string;
  /** Optional card id for UI association (replaces old groupId). */
  cardId?: string;
}

export interface AppConfig {
  workspace: string;
  port?: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface SceneValidationResult {
  id: string;
  ok: boolean;
  issues: ValidationIssue[];
}
