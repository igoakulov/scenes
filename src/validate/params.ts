import type {
  ParamField,
  ParamValidationIssue,
  ValidationIssue,
} from "../types.js";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function validateParamFields(
  fields: unknown,
  basePath: string,
): { fields?: ParamField[]; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(fields)) {
    issues.push({ path: basePath, message: "want array" });
    return { issues };
  }

  const seen = new Set<string>();
  const out: ParamField[] = [];

  fields.forEach((field, i) => {
    const p = `${basePath}[${i}]`;
    const before = issues.length;

    if (!isPlainObject(field)) {
      issues.push({ path: p, message: "want object" });
      return;
    }

    if (typeof field.key !== "string" || field.key.trim() === "") {
      issues.push({ path: `${p}.key`, message: "want non-empty string" });
    } else if (seen.has(field.key)) {
      issues.push({ path: `${p}.key`, message: `duplicate "${field.key}"` });
    } else {
      seen.add(field.key);
    }

    if (typeof field.label !== "string" || field.label.trim() === "") {
      issues.push({ path: `${p}.label`, message: "want non-empty string" });
    }

    const type = field.type;
    if (type !== "number" && type !== "boolean" && type !== "select") {
      issues.push({
        path: `${p}.type`,
        message: "want number|boolean|select",
      });
      return;
    }

    if (type === "number") {
      if (typeof field.min !== "number" || !Number.isFinite(field.min)) {
        issues.push({ path: `${p}.min`, message: "want finite number" });
      }
      if (typeof field.max !== "number" || !Number.isFinite(field.max)) {
        issues.push({ path: `${p}.max`, message: "want finite number" });
      }
      if (typeof field.default !== "number" || !Number.isFinite(field.default)) {
        issues.push({ path: `${p}.default`, message: "want finite number" });
      }
      if (
        typeof field.min === "number" &&
        typeof field.max === "number" &&
        field.min > field.max
      ) {
        issues.push({ path: `${p}.min`, message: "must be <= max" });
      }
      if (
        field.step !== undefined &&
        (typeof field.step !== "number" ||
          !Number.isFinite(field.step) ||
          field.step <= 0)
      ) {
        issues.push({ path: `${p}.step`, message: "want positive number" });
      }
      if (
        issues.length === before &&
        typeof field.key === "string" &&
        typeof field.label === "string"
      ) {
        out.push({
          key: field.key,
          type: "number",
          label: field.label,
          min: field.min as number,
          max: field.max as number,
          default: field.default as number,
          ...(field.step !== undefined ? { step: field.step as number } : {}),
        });
      }
      return;
    }

    if (type === "boolean") {
      if (typeof field.default !== "boolean") {
        issues.push({ path: `${p}.default`, message: "want boolean" });
      }
      if (
        issues.length === before &&
        typeof field.key === "string" &&
        typeof field.label === "string"
      ) {
        out.push({
          key: field.key,
          type: "boolean",
          label: field.label,
          default: field.default as boolean,
        });
      }
      return;
    }

    if (!Array.isArray(field.options) || field.options.length === 0) {
      issues.push({ path: `${p}.options`, message: "want non-empty string[]" });
    } else {
      field.options.forEach((opt, j) => {
        if (typeof opt !== "string") {
          issues.push({ path: `${p}.options[${j}]`, message: "want string" });
        }
      });
    }
    if (typeof field.default !== "string") {
      issues.push({ path: `${p}.default`, message: "want string" });
    } else if (
      Array.isArray(field.options) &&
      field.options.every((o) => typeof o === "string") &&
      !field.options.includes(field.default)
    ) {
      issues.push({ path: `${p}.default`, message: "must be in options" });
    }
    if (
      issues.length === before &&
      typeof field.key === "string" &&
      typeof field.label === "string"
    ) {
      out.push({
        key: field.key,
        type: "select",
        label: field.label,
        options: field.options as string[],
        default: field.default as string,
      });
    }
  });

  if (issues.length > 0) return { issues };
  return { fields: out, issues: [] };
}

export function defaultsFromFields(
  fields: ParamField[],
): Record<string, number | boolean | string> {
  const defaults: Record<string, number | boolean | string> = {};
  for (const f of fields) {
    defaults[f.key] = f.default;
  }
  return defaults;
}

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
    if (item.groupId !== undefined && typeof item.groupId !== "string") {
      shapeIssues.push({ path: `${p}.groupId`, message: "want string" });
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
