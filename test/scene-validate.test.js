import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateScene } from "../dist/validate/scene.js";

const fixtures = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "fixtures",
);

async function copyFixture(name, workspace, id = name) {
  const dest = join(workspace, "scenes", id);
  await mkdir(join(workspace, "scenes"), { recursive: true });
  await cp(join(fixtures, name), dest, { recursive: true });
}

describe("validateScene", () => {
  it("accepts valid scene (metadata defaults + three import)", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-val-"));
    await copyFixture("valid-basic", workspace, "valid-basic");
    const result = await validateScene(workspace, "valid-basic");
    assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2));
  });

  it("fails invalid metadata", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-val-"));
    await copyFixture("invalid-metadata", workspace, "bad-meta");
    const result = await validateScene(workspace, "bad-meta");
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.includes("title")));
  });

  it("fails when validateParams rejects defaults", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-val-"));
    await copyFixture("valid-params-fail", workspace, "params-fail");
    const result = await validateScene(workspace, "params-fail");
    assert.equal(result.ok, false);
    assert.ok(result.issues.some((i) => i.path.startsWith("params")));
  });

  it("accepts valid runtime export and rejects bad keys/types", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-val-"));
    await copyFixture("valid-basic", workspace, "rt-ok");
    const { writeFile } = await import("node:fs/promises");
    const dir = join(workspace, "scenes", "rt-ok");
    await writeFile(
      join(dir, "scene.js"),
      `
import * as THREE from "three";
export const runtime = { lights: false, helpers: true, camera: true, playback: false };
export function setup(host) {
  host.root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial()));
}
`,
      "utf8",
    );
    const ok = await validateScene(workspace, "rt-ok");
    assert.equal(ok.ok, true, JSON.stringify(ok.issues, null, 2));

    await writeFile(
      join(dir, "scene.js"),
      `
export const runtime = { grid: false };
export function setup() {}
`,
      "utf8",
    );
    const bad = await validateScene(workspace, "rt-ok");
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some((i) => i.path.includes("runtime")));
  });

  it("accepts update function and rejects non-function update", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-val-"));
    await copyFixture("valid-basic", workspace, "upd-ok");
    const { writeFile } = await import("node:fs/promises");
    const dir = join(workspace, "scenes", "upd-ok");
    await writeFile(
      join(dir, "scene.js"),
      `
import * as THREE from "three";
export function setup(host) {
  host.root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial()));
}
export function update(host, t, dt) {
  void host; void t; void dt;
}
`,
      "utf8",
    );
    const ok = await validateScene(workspace, "upd-ok");
    assert.equal(ok.ok, true, JSON.stringify(ok.issues, null, 2));

    await writeFile(
      join(dir, "scene.js"),
      `
export function setup() {}
export const update = 1;
`,
      "utf8",
    );
    const bad = await validateScene(workspace, "upd-ok");
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some((i) => i.path === "scene.update"));
  });
});
