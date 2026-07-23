import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const bin = join(root, "bin/scenes.js");
const fixtures = join(root, "test/fixtures");

function runScenes(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], {
      env: { ...process.env, ...env },
      cwd: env.SCENES_TEST_CWD || root,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

describe("CLI", () => {
  it("fails without workspace", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "scenes-cfg-"));
    // Any command that needs config workspace (list / validate / show).
    const r = await runScenes(["list"], { SCENES_CONFIG_DIR: configDir });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /no workspace/);
    await rm(configDir, { recursive: true, force: true });
  });

  it("init + list (no scene.js import) + validate", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-ws-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenes-cfg-"));
    const env = { SCENES_CONFIG_DIR: configDir };

    let r = await runScenes(["init", workspace], env);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /^workspace /m);

    const config = JSON.parse(
      await readFile(join(configDir, "config.json"), "utf8"),
    );
    assert.equal(config.workspace, workspace);

    await cp(join(fixtures, "valid-basic"), join(workspace, "scenes", "demo"), {
      recursive: true,
    });

    // list must not import scene.js
    const bombDir = join(workspace, "scenes", "bomb");
    await mkdir(bombDir, { recursive: true });
    await writeFile(
      join(bombDir, "metadata.json"),
      JSON.stringify({
        title: "Bomb",
        description: "list must not load scene",
        tags: [],
      }),
    );
    await writeFile(
      join(bombDir, "scene.js"),
      `throw new Error("scene.js must not be imported by list");\nexport function setup() {}\n`,
    );

    r = await runScenes(["list"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /@ scenes\/demo/);
    assert.match(r.stdout, /@ scenes\/bomb/);

    r = await runScenes(["validate", "demo"], env);
    assert.equal(r.code, 0, r.stderr + r.stdout);

    r = await runScenes(["validate", "bomb"], env);
    assert.equal(r.code, 1);

    await rm(workspace, { recursive: true, force: true });
    await rm(configDir, { recursive: true, force: true });
  });

  it("init defaults to cwd", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "scenes-cwd-"));
    const configDir = await mkdtemp(join(tmpdir(), "scenes-cfg-"));
    const r = await runScenes(["init"], {
      SCENES_CONFIG_DIR: configDir,
      SCENES_TEST_CWD: workspace,
    });
    assert.equal(r.code, 0, r.stderr);
    const config = JSON.parse(
      await readFile(join(configDir, "config.json"), "utf8"),
    );
    assert.equal(
      await realpath(config.workspace),
      await realpath(workspace),
    );
  });
});
