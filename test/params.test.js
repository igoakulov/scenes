import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultsFromWritable,
  resolveLabelValue,
  validateParamsTree,
} from "../dist/validate/params.js";

describe("validateParamsTree", () => {
  it("accepts card tree, empty array, and flat defaults", () => {
    const empty = validateParamsTree([], "params");
    assert.equal(empty.issues.length, 0);
    assert.deepEqual(empty.nodes, []);
    assert.deepEqual(empty.writable, []);

    const { nodes, writable, issues } = validateParamsTree(
      [
        {
          type: "card",
          title: "Demo",
          children: [
            { type: "note", text: "Hello" },
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
            { type: "label", label: "Fixed", value: "x" },
            {
              type: "card",
              title: "Nested",
              children: [
                {
                  key: "nested_n",
                  type: "number",
                  label: "N",
                  min: 1,
                  max: 3,
                  default: 2,
                },
              ],
            },
          ],
        },
      ],
      "params",
    );
    assert.equal(issues.length, 0, JSON.stringify(issues));
    assert.equal(nodes?.length, 1);
    assert.equal(writable?.length, 4);
    assert.deepEqual(defaultsFromWritable(writable), {
      size: 1,
      on: false,
      kind: "a",
      nested_n: 2,
    });
  });

  it("rejects incomplete number field", () => {
    const { issues } = validateParamsTree(
      [
        {
          type: "card",
          title: "C",
          children: [{ key: "n", type: "number", label: "N", default: 1 }],
        },
      ],
      "params",
    );
    assert.ok(issues.some((i) => i.path.includes("min")));
  });

  it("rejects duplicate keys across nested cards", () => {
    const { issues } = validateParamsTree(
      [
        {
          type: "card",
          title: "A",
          children: [
            {
              key: "x",
              type: "number",
              label: "X",
              min: 0,
              max: 1,
              default: 0,
            },
            {
              type: "card",
              title: "B",
              children: [
                {
                  key: "x",
                  type: "number",
                  label: "X2",
                  min: 0,
                  max: 1,
                  default: 1,
                },
              ],
            },
          ],
        },
      ],
      "params",
    );
    assert.ok(issues.some((i) => i.message.includes("duplicate")));
  });

  it("rejects fields + children dual schema", () => {
    const { issues } = validateParamsTree(
      [
        {
          type: "card",
          title: "C",
          fields: [],
          children: [],
        },
      ],
      "params",
    );
    assert.ok(issues.some((i) => i.path.includes("fields")));
  });

  it("allows writable nodes at root (array of nodes)", () => {
    const { writable, issues } = validateParamsTree(
      [
        {
          key: "solo",
          type: "number",
          label: "Solo",
          min: 0,
          max: 1,
          default: 0,
        },
      ],
      "params",
    );
    assert.equal(issues.length, 0);
    assert.equal(writable?.length, 1);
  });

  it("accepts number unit and derived label function", () => {
    const { nodes, writable, issues } = validateParamsTree(
      [
        {
          key: "a_base",
          type: "number",
          label: "Base",
          min: 0,
          max: 10,
          default: 3,
          unit: "u",
        },
        {
          key: "a_height",
          type: "number",
          label: "Height",
          min: 0,
          max: 10,
          default: 2,
          unit: "u",
        },
        {
          type: "label",
          label: "Area",
          value: (p) => (0.5 * p.a_base * p.a_height).toFixed(2),
        },
      ],
      "params",
    );
    assert.equal(issues.length, 0, JSON.stringify(issues));
    assert.equal(writable?.length, 2);
    assert.equal(writable?.[0].unit, "u");
    const area = nodes?.[2];
    assert.equal(area?.type, "label");
    assert.equal(
      resolveLabelValue(area.value, { a_base: 3, a_height: 2 }),
      "3.00",
    );
  });
});
