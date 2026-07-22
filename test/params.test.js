import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateParamFields } from "../dist/validate/params.js";

describe("validateParamFields", () => {
  it("accepts number, boolean, select", () => {
    const { fields, issues } = validateParamFields(
      [
        {
          key: "size",
          type: "number",
          label: "Size",
          min: 0,
          max: 10,
          default: 1,
        },
        { key: "on", type: "boolean", label: "On", default: false },
        {
          key: "kind",
          type: "select",
          label: "Kind",
          options: ["a", "b"],
          default: "a",
        },
      ],
      "params",
    );
    assert.equal(issues.length, 0);
    assert.equal(fields?.length, 3);
  });

  it("rejects incomplete number field", () => {
    const { issues } = validateParamFields(
      [{ key: "n", type: "number", label: "N", default: 1 }],
      "params",
    );
    assert.ok(issues.some((i) => i.path.includes("min")));
  });
});
