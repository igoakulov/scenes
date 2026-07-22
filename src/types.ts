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

export type ParamType = "number" | "boolean" | "select";

export interface NumberParamField {
  key: string;
  type: "number";
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
}

export interface BooleanParamField {
  key: string;
  type: "boolean";
  label: string;
  default: boolean;
}

export interface SelectParamField {
  key: string;
  type: "select";
  label: string;
  options: string[];
  default: string;
}

export type ParamField = NumberParamField | BooleanParamField | SelectParamField;

export interface ParamValidationIssue {
  message: string;
  key?: string;
  groupId?: string;
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
