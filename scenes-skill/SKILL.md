---
name: scenes
description: >-
  Author and iterate interactive educational scenes (pretty much pure Three.js)
  with the Scenes CLI and local viewer. Use when the user wants teachers/students
  scene exploration via an agent, or organized 3D model showcase demos.
---

# Scenes

Plain Three.js scene folders + `scenes` CLI + local viewer. Content under `host.root`; runtime owns loop, chrome, and defaults unless opted out.

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
  assets/                # optional
```

Create scene folders with file tools — no `scenes new`.

## Content guidelines

Unless the human states otherwise:

- RH Y-up (Three defaults): +X right, +Y up, +Z toward viewer on face-on XY.
- Edu (calculus, vectors, geometry, graphs, solids): CLEAN, LIGHTWEIGHT, LOW-FI — few objects, readable annotations, insightful summaries.
- Showcases / capability demos: MAX EFFORT — higher fidelity and creative freedom.
- Primary content near origin, modest unit scale.
- Things the user should play with (sizes, dimensions, angles, scales, show/hide, modes, …) → add cards and params(), more details below; skip fixed decoration.

## Contract (must follow)

### metadata.json

```json
{
  "title": "Polyline through points",
  "description": "Edit x,y pairs; runtime redraws a polyline in the XY plane. Math: $y = f(x)$ samples.",
  "tags": ["geometry", "graphs"],
  "dimensions": 3,
  "attribution": { "model": "gpt-…", "author": "…" }
}
```

- title, description, tags: required
- dimensions: optional 2 | 3 (default 3) → 3 perspective+orbit, 2 ortho face-on pan/zoom
- attribution: optional object

### Runtime

```js
export const runtime = { lights: true, helpers: true, camera: true, playback: true };
// omit export or key = true
```

MAY override (one flag each):

- lights — true: host defaults; any THREE.Light under root hides defaults. false: no host defaults.
- helpers — true: host origin reference planes. false: none.
- camera — true: host navigation; first THREE.Camera under root on initial load only → start pose (position/look; FOV ignored), then removed. false: move host.camera; bind input to host.domElement.
- playback — true: host play/pause later. false: no host transport. Static setup only until update ships.

MUST NOT:

- Own requestAnimationFrame / setAnimationLoop for sim or draw.
- Private animation clocks (setInterval/setTimeout time base, GSAP ticker, etc.).
- OrbitControls or other navigation when runtime.camera is true.
- Custom label DOM — only userData.annotation strings (KaTeX $…$ / $$…$$ ok).
- host.renderer or a second WebGL canvas.

### host (setup argument)

- root — THREE.Object3D; parent all content here
- params — flat bag from params() + live edits
- baseUrl — absolute scene folder URL (trailing /); assets via new URL("assets/…", host.baseUrl)
- camera — host THREE.Camera
- domElement — host WebGL canvas

### Interactive cards + params()

Host renders user interaction cards from `export function params()` → node array (or omit / `[]`). Cards can mix: editable fields (land in host.params), computed display-only labels, guidance notes. On user edit: optional onParamsChange(params, change) with change = { key, value } → bag; host clears host.root and re-runs setup(host) from the bag. Optional validateParams(params) → soft issues [{ key?, message, cardId? }…] or []; checked by scenes validate on defaults (not live UI). Unknown `type` fails validate.

Types:

- card — layout. title, children[], optional id
- note — guidance prose. text (KaTeX ok). No key (not in host.params)
- label — computed display-only. label, value string OR (params) => string. No key
- number → editable number. key, label, default, min, max required; optional step, unit
- boolean → editable boolean. key, label, default
- select → editable string. key, label, options[], default ∈ options
- multiselect → editable string[]. key, label, options[], default[] each ∈ options
- string → editable string. key, label, default; optional placeholder

Rules:

- Single ordered children on cards — NO parallel fields
- Writable keys UNIQUE tree-wide; bag FLAT
- Angles: number + unit "rad" or "°" — no angle type
- Vectors: separate number keys (v_x, v_y, v_z)
- Freeform lists: string + parse in setup; format in placeholder
- Fixed multi flags: multiselect
- Do NOT invent types (vector, color, angle, text, …)

### scene.js example

```js
import * as THREE from "three";

// export const runtime = { lights: true, helpers: true, camera: true, playback: true };

export function setup(host) {
  const p = host.params;
  const layers = Array.isArray(p.layers) ? p.layers : [];
  const pts = parseXYPairs(p.points ?? "");
  const lift = (p.lift ?? 0) * Math.PI / 180;

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

  if (layers.includes("ends")) {
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshStandardMaterial({
          color: i === 0 || i === pts.length - 1 ? 0x22c55e : 0x64748b,
        }),
      );
      m.position.set(x, y, 0);
      m.name = `pt-${i}`;
      host.root.add(m);
    }
  }

  if (layers.includes("offset")) {
    const ox = p.off_x ?? 0, oy = p.off_y ?? 0, oz = p.off_z ?? 0;
    const dir = new THREE.Vector3(ox, oy, oz);
    if (dir.lengthSq() > 1e-8) {
      const arr = new THREE.ArrowHelper(
        dir.clone().normalize(), new THREE.Vector3(0, 0, 0), dir.length(), 0x88aaff,
      );
      arr.name = "offset";
      host.root.add(arr);
    }
  }

  if (p.show_label !== false) {
    const ann = new THREE.Object3D();
    ann.position.set(pts[pts.length - 1][0], pts[pts.length - 1][1] + 0.25, 0);
    ann.userData.annotation = `${pts.length} pts`;
    ann.name = "count-label";
    host.root.add(ann);
  }

  // assets: new URL("assets/tex.png", host.baseUrl).href
}

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
        { type: "note", text: "Samples as $x,y$ pairs." }, // guidance note (not in host.params)
        { key: "points", type: "string", label: "Points", default: "0,0; 1,1; 2,0.5; 3,2", placeholder: "x,y; x,y; …" }, // user-editable
        { key: "lift", type: "number", label: "Yaw", min: -45, max: 45, step: 1, default: 0, unit: "°" },
        { key: "show_label", type: "boolean", label: "Count annotation", default: true },
        { key: "layers", type: "multiselect", label: "Show", options: ["curve", "ends", "offset"], default: ["curve", "ends"] },
        { type: "label", label: "Segment count", value: (q) => Math.max(0, String(q.points || "").split(";").filter((s) => s.trim()).length - 1) }, // computed display-only
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

export function onParamsChange(params, change) {
  // optional; change = { key, value }
  if (change.key === "lift" && params.lift > 30) {
    return { ...params, lift: 30 };
  }
  return params;
}

export function validateParams(params) {
  // optional; scenes validate (defaults); [] = ok
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
cp -R scenes/my-scene scenes/.my-scene         # leading . hides from Library; CLI still targets
```

Prefer git in the workspace for anything more advanced.
