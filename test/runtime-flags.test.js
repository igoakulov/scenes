import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RUNTIME_FLAGS,
  resolveRuntimeFlags,
} from "../viewer/src/runtime/runtimeFlags.ts";

describe("resolveRuntimeFlags", () => {
  it("defaults all true when omitted", () => {
    assert.deepEqual(resolveRuntimeFlags(undefined), DEFAULT_RUNTIME_FLAGS);
    assert.deepEqual(resolveRuntimeFlags({}), DEFAULT_RUNTIME_FLAGS);
  });

  it("merges explicit false", () => {
    const f = resolveRuntimeFlags({ lights: false, camera: false });
    assert.equal(f.lights, false);
    assert.equal(f.helpers, true);
    assert.equal(f.camera, false);
    assert.equal(f.playback, true);
  });

  it("rejects unknown keys and non-booleans", () => {
    assert.throws(() => resolveRuntimeFlags({ grid: false }), /unknown key/);
    assert.throws(() => resolveRuntimeFlags({ lights: 1 }), /boolean/);
    assert.throws(() => resolveRuntimeFlags([]), /plain object/);
  });
});
