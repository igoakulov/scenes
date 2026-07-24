---
name: scenes
description: >-
  Author and iterate interactive educational scenes (pretty much pure Three.js)
  with the Scenes CLI and local viewer. Use when the user wants teachers/students
  scene exploration via an agent, or organized 3D model showcase demos.
---

# Scenes

Plain Three.js scene folders + `scenes` CLI + local viewer. You write content; runtime owns camera, lights, Grid, sheet chrome, Explore cards (when available), annotation chips.

## Install

```bash
# TODO: package not published yet — until then use a local checkout, e.g.:
#   npm install -g /path/to/scenes
#   # or: npm link  (from the scenes repo)
npm install -g scenes          # preferred once published (npm name may change)
scenes init [path]             # once per machine/workspace; omit path → cwd
```

## Authoring guidelines

Unless the human states otherwise:

- Simple educational topics (calculus, vectors, geometry, graphs, basic solids): CLEAN, LIGHTWEIGHT, LOW-FI — clear meshes, few objects, readable annotations.
- Showcases / model capability demos: MAX EFFORT — higher fidelity, careful composition, strong Summary + cards.
- NO ANIMATION — static `setup` only; no `requestAnimationFrame`, no `update`, no tween loops.
- NO custom lights / Grid / axes unless required — runtime provides ambient + directional lights and Grid.
- NO own camera controls — runtime orbit (3D) / pan-zoom (2D). Frame content for DEFAULT VIEW ~`(6, 4, 8)` → origin (3D); face-on XY when `dimensions: 2`. Primary content near origin, modest unit scale.

## Workspace

- WORKSPACE: `<ws>/scenes/<id>/` — id = kebab-case folder name
- CONFIG: `~/.config/scenes/config.json` — `workspace`, optional `port`

```text
<ws>/scenes/<id>/
  metadata.json
  scene.js
  assets/                # optional
```

Create scene folders with file tools — there is no `scenes new`.

## Contract (one scene)

### `metadata.json`

```json
{
  "title": "Triangle comparison",
  "description": "Educational summary + conversation notes. Math: $E=mc^2$ or $$\\int x\\,dx$$.",
  "tags": ["geometry"],
  "dimensions": 3, // optional 2|3; default 3 → orbit, 2 → pan/zoom
  "attribution": { "model": "gpt-…", "author": "…" } // optional
}
```

### World

RH Y-UP (Three defaults): +X right, +Y up, +Z toward viewer on face-on XY; into scene = −Z.

### `scene.js`

```js
import * as THREE from "three";

// setup once per load; ctx.params = flat defaults from writable params() fields
// ctx: root, params, baseUrl (absolute scene folder URL, trailing /)

export function setup(ctx) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(ctx.params.size ?? 1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x88aaff }),
  );
  mesh.name = "box";
  ctx.root.add(mesh);

  // annotation: empty Object3D + userData.annotation (runtime CSS2D + KaTeX)
  const label = new THREE.Object3D();
  label.position.set(0, 0.8, 0);
  label.userData.annotation = "Unit cube · $1\\times1\\times1$";
  label.name = "box-label";
  ctx.root.add(label);

  // --- optional: local media under assets/ ---
  // const texUrl = new URL("assets/tex.png", ctx.baseUrl).href; // path relative to scene folder
  // const tex = new THREE.TextureLoader().load(texUrl);
  // mesh.material.map = tex;
}

// Omit params / return [] if no Explore cards.
// Locked: array of nodes; card = { type:"card", title, children[] }; single children list
// (note/label/controls; nest cards sparingly). No parallel `fields`. Writable keys unique
// tree-wide and flat on ctx.params (prefix: a_base, b_base) — not nested objects.
// number may include unit (display only). label.value = string OR (params) => string (derived).

export function params() {
  return [
    {
      type: "card", // id: "tri" optional
      title: "Triangle comparison",
      children: [
        { type: "note", text: "Area $= \\tfrac12 · base · height$." },
        { key: "size", type: "number", label: "Box size", min: 0.1, max: 5, step: 0.1, default: 1, unit: "u" },
        { key: "on", type: "boolean", label: "On", default: true },
        { key: "kind", type: "select", label: "Kind", options: ["solid", "wire"], default: "solid" },
        {
          type: "card", title: "Triangle A", // nested example; params stay flat (a_base, not triangle.a_base)
          children: [
            { key: "a_base", type: "number", label: "Base", min: 0.5, max: 8, step: 0.1, default: 3, unit: "u" },
            { key: "a_height", type: "number", label: "Height", min: 0.5, max: 8, step: 0.1, default: 2, unit: "u" },
            { type: "label", label: "Color", value: "blue" },
            // derived: recomputed when writables change (panel passes flat ctx.params)
            { type: "label", label: "Area", value: (p) => (0.5 * p.a_base * p.a_height).toFixed(2) },
          ],
        },
      ],
    },
  ];
}

// export function onParamsChange(params, change) { return params; }  // optional
// export function validateParams(params) { return []; }             // optional { key?, message, cardId? }[]
```

## Loop (agent)

```bash
# no workspace yet? → scenes init [path]  (Install)
scenes list                              # prints: workspace /abs/path
cd /abs/path                             # same path as the workspace line
mkdir -p scenes/my-scene
# create metadata.json + scene.js (see above) based on user request
scenes validate my-scene                 # re-run after edits until clean
scenes show my-scene                     # open one scene; keep process running
# scenes show                            # alternative: user wants to browse library (no id)
```

After later edits: re-validate if needed, then TELL THE USER TO REFRESH the browser — do NOT restart `show`.
Kill + re-run `show` only to switch scene id, recover a dead/wedged server, or free the port; then tell the user to reopen/refresh the URL.
