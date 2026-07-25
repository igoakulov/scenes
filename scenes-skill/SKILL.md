---
name: scenes
description: >-
  Author and iterate interactive educational scenes (pretty much pure Three.js)
  with the Scenes CLI and local viewer. Use when the user wants teachers/students
  scene exploration via an agent, or organized 3D model showcase demos.
---

# Scenes

Plain Three.js scene folders + `scenes` CLI + local viewer. Content under `ctx.root`; runtime owns interaction chrome and defaults (below).

## Install

```bash
# TODO: package not published yet — until then use a local checkout, e.g.:
#   npm install -g /path/to/scenes
#   # or: npm link  (from the scenes repo)
npm install -g scenes          # preferred once published (npm name may change)
scenes init [path]             # once per machine/workspace; omit path → cwd
```

## Authoring guidelines

Style (unless the human states otherwise):

- Simple educational topics (calculus, vectors, geometry, graphs, basic solids): CLEAN, LIGHTWEIGHT, LOW-FI — clear meshes, few objects, readable annotations.
- Showcases / model capability demos: MAX EFFORT — higher fidelity, careful composition, strong Summary + cards.
- Prefer primary content near origin, modest unit scale.

Runtime provides (product rules; parent under `ctx.root` with normal three.js where OVERRIDE OK):

- LIGHTS (OVERRIDE OK) — ambient + directional defaults; any `THREE.Light` under `ctx.root` REPLACES them (showcases). No lights → defaults stay.
- GRID (NEVER ADD origin XY/XZ/YZ) — runtime planes through origin (Explore: planes, size, step). Origin-aligned `GridHelper` / `AxesHelper` stripped. Diagonal or off-origin guides OK.
- CAMERA / CONTROLS (OVERRIDE OK start pose only) — `dimensions` 3 → perspective FOV 55° + orbit; 2 → ortho + pan/zoom. Default view ~`(6,4,8)` → origin (3); face-on XY (2). Explore remounts `setup` but KEEPS camera. Optional `THREE.Camera` under `ctx.root` on load: copies position + look, removes it; FOV/near/far/projection ignored; `dimensions` still required. NEVER ADD `OrbitControls` / own control or rAF loops.
- CHROME (NEVER ADD custom labels) — sheet (Library / Summary / Explore); Explore from `params()`; only `userData.annotation` chips (KaTeX `$…$` / `$$…$$` ok).
- ANIMATION (NEVER ADD) — static `setup` only; no `requestAnimationFrame` / `update` / tweens.

## Workspace

- WORKSPACE: `<ws>/scenes/<id>/` — id = kebab-case folder name
- CONFIG: `~/.config/scenes/config.json` — `workspace`, optional `port`

```text
<ws>/scenes/<id>/
  metadata.json
  scene.js
  assets/                # optional
```

- `id` = kebab-case folder name (`my-scene`); optional leading `.` (see Versioning and backup)
- Create scene folders with file tools — there is no `scenes new`

### Versioning and backup

- Copy scene folder (`cp -R scenes/id scenes/other-id`, or host file tools). Use hidden folders (e.g. `.my-scene`) for necessary copies that user doesn't want to see in viewer UI (Library tab). CLI `list` / `validate` / `show` still works with them.
- Use Git in the workspace for anything more advanced.

## Contract (one scene)

### `metadata.json`

```json
{
  "title": "Polyline through points",
  "description": "Edit x,y pairs; runtime redraws a polyline in the XY plane. Math: $y = f(x)$ samples.",
  "tags": ["geometry", "graphs"],
  "dimensions": 3,
  "attribution": { "model": "gpt-…", "author": "…" }
}
```

- `dimensions`: optional 2 | 3 (default 3) → control/projection mode (not replaced by a scene `Camera`)
- `attribution`: optional object

### World

RH Y-UP (Three defaults): +X right, +Y up, +Z toward viewer on face-on XY; into scene = −Z.

### `params()` node types (exhaustive)

`export function params()` returns an array of nodes. Omit or return `[]` if no Explore cards.

VALID `type` VALUES ONLY (no aliases — unknown types fail `scenes validate`):

- `card` — layout only. Fields: `title`, `children[]`, optional `id`
- `note` — RO prose. Fields: `text` (KaTeX `$…$` / `$$…$$` ok). No `key`
- `label` — RO row. Fields: `label`, `value` string OR `(params) => string` (derived; recomputed when controls change). No `key`
- `number` → `ctx.params[key]` is number. Fields: `key`, `label`, `default`, MIN, MAX (required), optional `step`, optional `unit` (display suffix only, e.g. `"°"`, `"u"`, `"rad"`)
- `boolean` → boolean. Fields: `key`, `label`, `default`
- `select` → string. Fields: `key`, `label`, `options: string[]`, `default` must be in options
- `multiselect` → string[]. Fields: `key`, `label`, `options: string[]`, `default: string[]` each ∈ options
- `string` → string. Fields: `key`, `label`, `default`, optional `placeholder` (in-input format hint)

Rules:

- Single ordered `children` on cards — NO parallel `fields`
- Writable keys UNIQUE tree-wide; bag is FLAT (`v_x`, not nested objects)
- Nest cards sparingly
- Angles: `number` + `unit: "rad"` or `unit: "°"` — no separate `angle` type
- 2–3 component vectors: SEPARATE `number` keys (`v_x`, `v_y`, `v_z`)
- Variable-length / free formats (polylines, long lists): `string` + parse in `setup`; put expected format in `placeholder`
- Multi flags from a fixed list: `multiselect` (not a comma-separated string)
- Do NOT invent types (`vector`, `color`, `angle`, `text`, …)

### `scene.js` (example — polyline + overlays)

```js
import * as THREE from "three";

// setup runs on load and again when Explore params change (camera stays put).
// ctx: root, params (flat bag), baseUrl (absolute scene folder URL, trailing /)

function parseXYPairs(raw) {
  const pts = String(raw).split(";").map((s) => s.trim()).filter(Boolean)
    .map((pair) => pair.split(/[\s,]+/).map(Number));
  if (pts.length < 2 || pts.some((p) => p.length < 2 || p.some((n) => !Number.isFinite(n)))) {
    return [[0, 0], [1, 1], [2, 0.5]]; // fallback if user mid-edit or bad tokens
  }
  return pts.map(([x, y]) => [x, y]);
}

export function setup(ctx) {
  const p = ctx.params;
  const layers = Array.isArray(p.layers) ? p.layers : [];
  const pts = parseXYPairs(p.points ?? "");
  const lift = (p.lift ?? 0) * Math.PI / 180; // degree unit in UI → radians here

  // Overrides (optional, under ctx.root): lights replace defaults; Camera = start pose only
  // ctx.root.add(new THREE.DirectionalLight(0xffffff, 1));
  // const cam = new THREE.PerspectiveCamera(); cam.position.set(4, 3, 6); cam.lookAt(0, 0, 0); ctx.root.add(cam);

  // polyline through points in XY, slight Y rotation for depth in 3D view
  if (layers.includes("curve")) {
    const pos = [];
    for (const [x, y] of pts) pos.push(x, y, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf97316 }));
    line.rotation.y = lift;
    line.name = "polyline";
    ctx.root.add(line);
  }

  // endpoint markers (small spheres)
  if (layers.includes("ends")) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshStandardMaterial({ color: i === 0 || i === pts.length - 1 ? 0x22c55e : 0x64748b }),
      );
      m.position.set(x, y, 0);
      m.name = `pt-${i}`;
      ctx.root.add(m);
    }
  }

  // optional offset arrow from origin using SEPARATE number components (not a vector type)
  if (layers.includes("offset")) {
    const ox = p.off_x ?? 0, oy = p.off_y ?? 0, oz = p.off_z ?? 0;
    const dir = new THREE.Vector3(ox, oy, oz);
    if (dir.lengthSq() > 1e-8) {
      const arr = new THREE.ArrowHelper(dir.clone().normalize(), new THREE.Vector3(0, 0, 0), dir.length(), 0x88aaff);
      arr.name = "offset";
      ctx.root.add(arr);
    }
  }

  if (p.show_label !== false) {
    const ann = new THREE.Object3D();
    ann.position.set(pts[pts.length - 1][0], pts[pts.length - 1][1] + 0.25, 0);
    // annotation: plain string; KaTeX only inside $...$ (in JS write \\ for one \)
    ann.userData.annotation = `${pts.length} pts`;
    ann.name = "count-label";
    ctx.root.add(ann);
  }

  // optional media: new URL("assets/tex.png", ctx.baseUrl).href
}

export function params() {
  return [
    {
      type: "card",
      title: "Polyline",
      children: [
        { type: "note", text: "Enter samples as $x,y$ pairs. Bad mid-edit strings fall back to the default path." },
        { key: "points", type: "string", label: "Points", default: "0,0; 1,1; 2,0.5; 3,2", placeholder: "x,y; x,y; …" },
        { key: "lift", type: "number", label: "Yaw", min: -45, max: 45, step: 1, default: 0, unit: "°" },
        { key: "show_label", type: "boolean", label: "Count annotation", default: true },
        { key: "layers", type: "multiselect", label: "Show", options: ["curve", "ends", "offset"], default: ["curve", "ends"] },
        { type: "label", label: "Segment count", value: (q) => Math.max(0, String(q.points || "").split(";").filter((s) => s.trim()).length - 1) },
        {
          type: "card",
          title: "Offset arrow (components)",
          children: [
            { type: "note", text: "Vectors = separate numbers, not one array field." },
            { key: "off_x", type: "number", label: "x", min: -3, max: 3, step: 0.1, default: 1, unit: "u" },
            { key: "off_y", type: "number", label: "y", min: -3, max: 3, step: 0.1, default: 0.5, unit: "u" },
            { key: "off_z", type: "number", label: "z", min: -3, max: 3, step: 0.1, default: 0, unit: "u" },
            { type: "label", label: "|offset|", value: (q) => Math.hypot(q.off_x ?? 0, q.off_y ?? 0, q.off_z ?? 0).toFixed(2) },
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
