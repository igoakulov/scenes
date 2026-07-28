import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_RUNTIME_FLAGS,
  issuesForRuntimeExport,
  resolveRuntimeFlags,
} from "../dist/runtime-flags.js";

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

  it("rejects unknown keys, non-booleans, null, and non-objects", () => {
    assert.throws(() => resolveRuntimeFlags({ grid: false }), /runtime\.grid: unknown key/);
    assert.throws(() => resolveRuntimeFlags({ loop: false }), /runtime\.loop: unknown key/);
    assert.throws(() => resolveRuntimeFlags({ lights: 1 }), /runtime\.lights: want boolean/);
    assert.throws(() => resolveRuntimeFlags([]), /runtime: want plain object/);
    assert.throws(() => resolveRuntimeFlags(null), /runtime: want plain object/);
  });
});

describe("issuesForRuntimeExport", () => {
  it("matches CLI paths and collects multiple issues", () => {
    assert.deepEqual(issuesForRuntimeExport(undefined), []);
    assert.deepEqual(issuesForRuntimeExport({}), []);
    assert.deepEqual(issuesForRuntimeExport(null), [
      { path: "scene.runtime", message: "want plain object" },
    ]);
    const multi = issuesForRuntimeExport({ loop: false, lights: "yes", camera: true });
    assert.ok(multi.some((i) => i.path === "scene.runtime.loop" && i.message === "unknown key"));
    assert.ok(multi.some((i) => i.path === "scene.runtime.lights" && i.message === "want boolean"));
    assert.equal(multi.some((i) => i.path === "scene.runtime.camera"), false);
  });
});
