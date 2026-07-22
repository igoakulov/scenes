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
});
