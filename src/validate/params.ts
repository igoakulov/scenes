import type {
  LabelParamNode,
  NoteParamNode,
  NumberParamField,
  BooleanParamField,
  SelectParamField,
  ParamCard,
  ParamValidationIssue,
  ParamValue,
  ParamsNode,
  ValidationIssue,
  WritableParamField,
} from "../types.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export interface ValidateParamsTreeResult {
  /** Parsed tree when shape is fully valid. */
  nodes?: ParamsNode[];
  /** Writable fields in tree order (for defaults / validateParams). */
  writable?: WritableParamField[];
  issues: ValidationIssue[];
}

/**
 * Validate `params()` return value: array of nodes with single ordered
 * `children` on cards; flat unique keys on writable fields.
 */
export function validateParamsTree(
  raw: unknown,
  basePath: string,
): ValidateParamsTreeResult {
  const issues: ValidationIssue[] = [];
  const seenKeys = new Set<string>();
  const seenCardIds = new Set<string>();
  const writable: WritableParamField[] = [];

  if (!Array.isArray(raw)) {
    issues.push({ path: basePath, message: "want array" });
    return { issues };
  }

  const nodes: ParamsNode[] = [];
  raw.forEach((item, i) => {
    const node = validateNode(item, `${basePath}[${i}]`, issues, seenKeys, seenCardIds, writable);
    if (node) nodes.push(node);
  });

  if (issues.length > 0) return { issues };
  return { nodes, writable, issues: [] };
}

function validateNode(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  seenCardIds: Set<string>,
  writable: WritableParamField[],
): ParamsNode | undefined {
  if (!isPlainObject(raw)) {
    issues.push({ path, message: "want object" });
    return undefined;
  }

  if ("fields" in raw && raw.fields !== undefined) {
    issues.push({
      path: `${path}.fields`,
      message: "unsupported; use single ordered children list (not fields + children)",
    });
  }

  const type = raw.type;
  if (typeof type !== "string") {
    issues.push({ path: `${path}.type`, message: "want string" });
    return undefined;
  }

  switch (type) {
    case "card":
      return validateCard(raw, path, issues, seenKeys, seenCardIds, writable);
    case "note":
      return validateNote(raw, path, issues);
    case "label":
      return validateLabel(raw, path, issues);
    case "number":
      return validateNumber(raw, path, issues, seenKeys, writable);
    case "boolean":
      return validateBoolean(raw, path, issues, seenKeys, writable);
    case "select":
      return validateSelect(raw, path, issues, seenKeys, writable);
    default:
      issues.push({
        path: `${path}.type`,
        message: "want card|note|label|number|boolean|select",
      });
      return undefined;
  }
}

function validateCard(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  seenCardIds: Set<string>,
  writable: WritableParamField[],
): ParamCard | undefined {
  const before = issues.length;

  if (typeof raw.title !== "string" || raw.title.trim() === "") {
    issues.push({ path: `${path}.title`, message: "want non-empty string" });
  }

  if (raw.id !== undefined) {
    if (typeof raw.id !== "string" || raw.id.trim() === "") {
      issues.push({ path: `${path}.id`, message: "want non-empty string" });
    } else if (seenCardIds.has(raw.id)) {
      issues.push({ path: `${path}.id`, message: `duplicate "${raw.id}"` });
    } else {
      seenCardIds.add(raw.id);
    }
  }

  if (!Array.isArray(raw.children)) {
    issues.push({ path: `${path}.children`, message: "want array" });
  }

  const children: ParamsNode[] = [];
  if (Array.isArray(raw.children)) {
    raw.children.forEach((child, i) => {
      const node = validateNode(
        child,
        `${path}.children[${i}]`,
        issues,
        seenKeys,
        seenCardIds,
        writable,
      );
      if (node) children.push(node);
    });
  }

  if (issues.length > before) return undefined;
  if (typeof raw.title !== "string") return undefined;

  const card: ParamCard = {
    type: "card",
    title: raw.title,
    children,
  };
  if (typeof raw.id === "string" && raw.id.trim() !== "") {
    card.id = raw.id;
  }
  return card;
}

function validateNote(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): NoteParamNode | undefined {
  if (typeof raw.text !== "string" || raw.text.trim() === "") {
    issues.push({ path: `${path}.text`, message: "want non-empty string" });
    return undefined;
  }
  if (raw.key !== undefined) {
    issues.push({
      path: `${path}.key`,
      message: "note is read-only; omit key (not in ctx.params)",
    });
  }
  return { type: "note", text: raw.text };
}

function validateLabel(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
): LabelParamNode | undefined {
  const before = issues.length;
  if (typeof raw.label !== "string" || raw.label.trim() === "") {
    issues.push({ path: `${path}.label`, message: "want non-empty string" });
  }
  // Static string or pure (params) => string for derived display (area, angles, …).
  if (typeof raw.value !== "string" && typeof raw.value !== "function") {
    issues.push({
      path: `${path}.value`,
      message: "want string or (params) => string",
    });
  }
  if (raw.key !== undefined) {
    issues.push({
      path: `${path}.key`,
      message: "label is read-only; omit key (not in ctx.params)",
    });
  }
  if (issues.length > before) return undefined;
  return {
    type: "label",
    label: raw.label as string,
    value: raw.value as LabelParamNode["value"],
  };
}

/** Resolve a label for display (string as-is; function called with flat params). */
export function resolveLabelValue(
  value: LabelParamNode["value"],
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

function registerKey(
  key: unknown,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
): key is string {
  if (typeof key !== "string" || key.trim() === "") {
    issues.push({ path: `${path}.key`, message: "want non-empty string" });
    return false;
  }
  if (seenKeys.has(key)) {
    issues.push({ path: `${path}.key`, message: `duplicate "${key}"` });
    return false;
  }
  seenKeys.add(key);
  return true;
}

function validateNumber(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): NumberParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  if (typeof raw.label !== "string" || raw.label.trim() === "") {
    issues.push({ path: `${path}.label`, message: "want non-empty string" });
  }
  if (typeof raw.min !== "number" || !Number.isFinite(raw.min)) {
    issues.push({ path: `${path}.min`, message: "want finite number" });
  }
  if (typeof raw.max !== "number" || !Number.isFinite(raw.max)) {
    issues.push({ path: `${path}.max`, message: "want finite number" });
  }
  if (typeof raw.default !== "number" || !Number.isFinite(raw.default)) {
    issues.push({ path: `${path}.default`, message: "want finite number" });
  }
  if (
    typeof raw.min === "number" &&
    typeof raw.max === "number" &&
    raw.min > raw.max
  ) {
    issues.push({ path: `${path}.min`, message: "must be <= max" });
  }
  if (
    raw.step !== undefined &&
    (typeof raw.step !== "number" ||
      !Number.isFinite(raw.step) ||
      raw.step <= 0)
  ) {
    issues.push({ path: `${path}.step`, message: "want positive number" });
  }
  if (raw.unit !== undefined && typeof raw.unit !== "string") {
    issues.push({ path: `${path}.unit`, message: "want string" });
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: NumberParamField = {
    type: "number",
    key: raw.key as string,
    label: raw.label as string,
    min: raw.min as number,
    max: raw.max as number,
    default: raw.default as number,
  };
  if (typeof raw.step === "number") field.step = raw.step;
  if (typeof raw.unit === "string") field.unit = raw.unit;
  writable.push(field);
  return field;
}

function validateBoolean(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): BooleanParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  if (typeof raw.label !== "string" || raw.label.trim() === "") {
    issues.push({ path: `${path}.label`, message: "want non-empty string" });
  }
  if (typeof raw.default !== "boolean") {
    issues.push({ path: `${path}.default`, message: "want boolean" });
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: BooleanParamField = {
    type: "boolean",
    key: raw.key as string,
    label: raw.label as string,
    default: raw.default as boolean,
  };
  writable.push(field);
  return field;
}

function validateSelect(
  raw: Record<string, unknown>,
  path: string,
  issues: ValidationIssue[],
  seenKeys: Set<string>,
  writable: WritableParamField[],
): SelectParamField | undefined {
  const before = issues.length;
  const keyOk = registerKey(raw.key, path, issues, seenKeys);

  if (typeof raw.label !== "string" || raw.label.trim() === "") {
    issues.push({ path: `${path}.label`, message: "want non-empty string" });
  }
  if (!Array.isArray(raw.options) || raw.options.length === 0) {
    issues.push({ path: `${path}.options`, message: "want non-empty string[]" });
  } else {
    raw.options.forEach((opt, j) => {
      if (typeof opt !== "string") {
        issues.push({ path: `${path}.options[${j}]`, message: "want string" });
      }
    });
  }
  if (typeof raw.default !== "string") {
    issues.push({ path: `${path}.default`, message: "want string" });
  } else if (
    Array.isArray(raw.options) &&
    raw.options.every((o) => typeof o === "string") &&
    !raw.options.includes(raw.default)
  ) {
    issues.push({ path: `${path}.default`, message: "must be in options" });
  }

  if (issues.length > before || !keyOk) return undefined;

  const field: SelectParamField = {
    type: "select",
    key: raw.key as string,
    label: raw.label as string,
    options: raw.options as string[],
    default: raw.default as string,
  };
  writable.push(field);
  return field;
}

/** Flat defaults object from writable fields only. */
export function defaultsFromWritable(
  writable: WritableParamField[],
): Record<string, ParamValue> {
  const defaults: Record<string, ParamValue> = {};
  for (const f of writable) {
    defaults[f.key] = f.default;
  }
  return defaults;
}

/** @deprecated Use defaultsFromWritable */
export const defaultsFromFields = defaultsFromWritable;

export function validateParamsResult(
  result: unknown,
  basePath: string,
): ValidationIssue[] {
  if (!Array.isArray(result)) {
    return [{ path: basePath, message: "want array" }];
  }

  const shapeIssues: ValidationIssue[] = [];
  result.forEach((item, i) => {
    const p = `${basePath}[${i}]`;
    if (!isPlainObject(item)) {
      shapeIssues.push({ path: p, message: "want object" });
      return;
    }
    if (typeof item.message !== "string" || item.message.trim() === "") {
      shapeIssues.push({ path: `${p}.message`, message: "want non-empty string" });
    }
    if (item.key !== undefined && typeof item.key !== "string") {
      shapeIssues.push({ path: `${p}.key`, message: "want string" });
    }
    if (item.cardId !== undefined && typeof item.cardId !== "string") {
      shapeIssues.push({ path: `${p}.cardId`, message: "want string" });
    }
    // Legacy groupId: reject so agents migrate
    if (item.groupId !== undefined) {
      shapeIssues.push({
        path: `${p}.groupId`,
        message: "unsupported; use cardId",
      });
    }
  });

  if (shapeIssues.length > 0) return shapeIssues;

  const out: ValidationIssue[] = [];
  for (const item of result as ParamValidationIssue[]) {
    const path = item.key ? `${basePath}.${item.key}` : basePath;
    out.push({ path, message: item.message });
  }
  return out;
}
