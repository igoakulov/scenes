---
name: scenes
description: >-
  Create interactive educational scenes (~ pure Three.js) with
  Scenes CLI + local viewer. Use to help user create or view scene.
---

# Scenes

You are teacher who uses Three.js to showcase STEM subjects and concepts for more visual, interactive learning. Package includes plain Three.js scene folders + `scenes` CLI + local viewer. Content under `host.root`; runtime owns loop, chrome, and defaults unless opted out.

## Install

```bash
# TODO: until published — npm install -g /path/to/scenes  (or npm link from checkout)
npm install -g scenes
scenes init [path]             # once; omit path → cwd
```

## Workspace

- CONFIG: `~/.config/scenes/config.json` — `workspace`, optional `port`
- Scene id = kebab-case folder name; optional leading `.` (see Versioning)

```text
<ws>/scenes/<id>/
  metadata.json
  scene.js
  assets/           # optional
```

Create scene folders with file tools.

## Content guidelines

Unless user states otherwise:

- RH Y-up (Three defaults): +X right, +Y up, +Z toward viewer on face-on XY.
- Edu (calculus, vectors, geometry, graphs, solids): CLEAN, LIGHTWEIGHT, LOW-FI — few objects, readable annotations, insightful summaries.
- Showcases / model benchmark demos: MAX EFFORT — higher fidelity and creative freedom.
- Primary content near origin, modest unit scale.
- Object / scene params user should play with (sizes, angles, scales, show/hide, modes, …) → use host-provided cards, not fixed decoration (see Interactive cards).

## Contract (MUST follow)

### metadata.json

```json
{
  "title": "Polyline through points",
  "description": "Edit x,y pairs; runtime redraws polyline...",
  "tags": ["geometry", "graphs"],
  "dimensions": 3,
  "attribution": { "model": "gpt-…", "author": "…" }
}
```

- title, description, tags: required
- description: long prose; simple markdown + KaTeX $…$ / $$…$$ ok
- dimensions: optional 2 | 3 (default 3) → 3 perspective+orbit, 2 ortho face-on pan/zoom
- attribution: optional object

### Runtime

```js
export const runtime = { lights: true, helpers: true, camera: true, playback: true }; // omit export or key = true
```

MAY override (one flag each):

- lights — true: host defaults; any THREE.Light under root hides defaults. false: no host defaults.
- helpers — true: host origin reference planes. false: none.
- camera — true: host navigation; first THREE.Camera under root on initial load only → start pose (position/look; FOV ignored), then removed. false: move host.camera; bind input to host.domElement. Do not bind `/` or `R`/`r` (host).
- playback — true: host play/pause when scene has `update` or host idle orbit (static 3D). false: no host transport or idle orbit.

MUST NOT:

- Private loops/clocks (rAF, setAnimationLoop, setInterval/setTimeout time base, GSAP ticker, …) — motion only via `update(host, t, dt)`.
- OrbitControls or other navigation when runtime.camera is true.
- Custom label DOM — only `userData.annotation` strings on Object3D under root (KaTeX $…$ / $$…$$ ok). Set in setup and/or reassign in `update`; host refreshes chip when string changes.
- host.renderer / second WebGL canvas.

### Animation

Optional `export function update(host, t, dt)` — host-driven time (`t` seconds, `dt` step); put ALL motion here. If `camera: false` and OrbitControls use damping, call `controls.update()` from `update`. Host may idle-orbit static 3D cameras — do not add it yourself.

### host (setup argument)

- root — THREE.Object3D; parent all content here
- params — flat bag from params() + live edits
- baseUrl — absolute scene folder URL (trailing /); assets via new URL("assets/…", host.baseUrl)
- camera — host THREE.Camera
- domElement — host WebGL canvas

### Interactive cards

`export function params()` → array of `{ type, … }` nodes (or omit / `[]`); same shape in card `children[]`. Host shows cards; editable fields fill flat `host.params`. Unknown `type` fails `scenes validate`.

DISPLAY types (no `key`, not in `host.params`):

- card — title, children[], optional id
- note — guidance prose; text (KaTeX ok)
- label — computed display; label, value string OR `(params) => string`

EDITABLE types (each has key, label, default → `host.params`):

- number — min, max required; optional step, unit
- boolean
- select — options[]; default ∈ options
- multiselect — options[]; default[] each ∈ options
- string — optional placeholder

LIFECYCLE

- User edits field → optional `onParamsChange(params, change)` with `change = { key, value }` MUST return next flat bag (return value authoritative) → host clears `host.root` and re-runs `setup(host)`.
- Optional `validateParams(params)` → soft issues `[{ key?, message, cardId? }…]` or `[]` — CLI `scenes validate` on defaults only (not live UI).

RULES

- Single ordered `children` on cards — no parallel field rows
- Writable keys UNIQUE tree-wide; bag FLAT
- Do NOT invent types (vector, color, angle, text, …)
- Angles: number + unit `"rad"` or `"°"` — unit is display-only; convert in setup/update yourself
- Vectors: separate number keys (`v_x`, `v_y`, `v_z`)
- Freeform lists: string + parse in setup; format in placeholder
- Fixed multi flags: multiselect

### scene.js example

```js
import * as THREE from "three";

// optional: export const runtime = { lights: true, helpers: true, camera: true, playback: true };
// optional: export function update(host, t, dt) { /* motion from t/dt only */ }

export function setup(host) {
  const p = host.params;
  const pts = parseXYPairs(p.points ?? ""); // freeform string → [[x,y],…] (no points type)
  const lift = (p.lift ?? 0) * Math.PI / 180; // number + unit "°"
  const layers = Array.isArray(p.layers) ? p.layers : [];

  if (layers.includes("curve")) {
    const pos = [];
    for (const [x, y] of pts) pos.push(x, y, 0);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf97316 }));
    line.rotation.y = lift;
    line.name = "polyline";
    host.root.add(line);
  }

  // nested-card vec3 → flat bag off_x/off_y/off_z
  if (layers.includes("marker")) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), new THREE.MeshBasicMaterial({ color: 0x88aaff }));
    m.position.set(p.off_x ?? 0, p.off_y ?? 0, p.off_z ?? 0);
    m.name = "offset-marker";
    host.root.add(m);
  }

  if (p.show_label !== false && pts.length) {
    const ann = new THREE.Object3D();
    ann.position.set(pts.at(-1)[0], pts.at(-1)[1] + 0.25, 0);
    ann.userData.annotation = `${pts.length} pts`; // host labels only
    ann.name = "count-label";
    host.root.add(ann);
  }

  // assets: new URL("assets/tex.png", host.baseUrl).href
}

// freeform list: parse string field in setup
function parseXYPairs(raw) {
  const pts = String(raw).split(";").map((s) => s.trim()).filter(Boolean)
    .map((pair) => pair.split(/[\s,]+/).map(Number));
  if (pts.length < 2 || pts.some((p) => p.length < 2 || p.some((n) => !Number.isFinite(n)))) {
    return [[0, 0], [1, 1], [2, 0.5]];
  }
  return pts.map(([x, y]) => [x, y]);
}

export function params() {
  return [
    {
      type: "card",
      title: "Polyline",
      children: [
        { type: "note", text: "Samples as $x,y$ pairs." }, // guidance (not in host.params)
        { key: "points", type: "string", label: "Points", default: "0,0; 1,1; 2,0.5; 3,2", placeholder: "x,y; x,y; …" }, // freeform list
        { key: "lift", type: "number", label: "Yaw", min: -45, max: 45, step: 1, default: 0, unit: "°" },
        { key: "show_label", type: "boolean", label: "Count annotation", default: true },
        { key: "layers", type: "multiselect", label: "Show", options: ["curve", "marker"], default: ["curve", "marker"] },
        { type: "label", label: "Segment count", value: (q) => Math.max(0, String(q.points || "").split(";").filter((s) => s.trim()).length - 1) }, // computed
        {
          type: "card",
          title: "Offset (components)",
          children: [
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

// optional: MUST return next bag
export function onParamsChange(params, change) {
  if (change.key === "lift" && params.lift > 30) return { ...params, lift: 30 };
  return params;
}

// optional: CLI scenes validate on defaults; [] = ok
export function validateParams(params) {
  if (String(params.points || "").split(";").filter((s) => s.trim()).length < 2) {
    return [{ key: "points", message: "need at least two points" }];
  }
  return [];
}
```

## Loop (agent)

```bash
scenes list                    # workspace /abs/path
cd /abs/path
mkdir -p scenes/my-scene
# write metadata.json + scene.js
scenes validate my-scene
scenes show my-scene           # keep running; or scenes show for library
```

Edits → tell user to refresh browser. Restart show only: switch id, dead server, or free port — then reopen/refresh URL.

## Versioning and backup

```bash
cp -R scenes/my-scene scenes/my-scene-backup   # or host file tools
cp -R scenes/my-scene scenes/.my-scene         # leading . hides from list UI; CLI still targets
```

For more use git.
