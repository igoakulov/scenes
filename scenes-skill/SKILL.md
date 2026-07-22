---
name: scenes
description: >-
  Author and iterate interactive educational scenes (pretty much pure Three.js)
  with the Scenes CLI and local viewer. Use when the user wants teachers/students
  scene exploration via an agent, or organized 3D model showcase demos.
---

# Scenes

Local **scenes** (plain Three.js modules) + `scenes` CLI. You write scenes; runtime/viewer comes later. No in-app chat, no geometry DSL.

## Workspace vs config

| | |
|--|--|
| **Workspace** | `<ws>/scenes/<id>/…` |
| **Config** | `~/.config/scenes/config.json` (win: `%APPDATA%\scenes\`) — active `workspace` path only |

- `scenes init` → workspace = **cwd**; or `scenes init <path>`
- Create scenes with file tools — **no** `scenes new`

## Scene layout

```text
<ws>/scenes/<scene-id>/     # id = kebab-case folder name
  metadata.json
  scene.js                  # ESM
  assets/                   # optional
```

### `metadata.json`

```json
{
  "title": "Example",
  "description": "Short educational summary.",
  "tags": ["topic"],
  "dimensions": 3,
  "attribution": { "model": "optional", "author": "optional" }
}
```

Required: `title`, `description`, `tags` (`string[]`, may be `[]`).  
Optional: `dimensions` — `2` or `3` (**default 3** if omitted).  
Optional: `attribution` (catalog only). Other keys preserved.

### `scene.js`

```js
import * as THREE from "three";

export function setup(ctx) {
  // ctx.root, ctx.params — no own render loop
}

export function params() {
  return [
    { key: "size", type: "number", label: "Size", min: 0.1, max: 10, default: 1 },
  ];
}

// optional: onParamsChange(params, change), validateParams(params) → {key?,message,groupId?}[]
```

Param types: `number` (min, max, default; step?), `boolean`, `select` (options + default).

## Loop

1. **Cold start:** `scenes list` or `help` → `workspace <abs>` + `@ scenes/<id>` blocks.
2. `scenes init` only if no workspace configured.
3. Edit scene files at `{workspace}/{@ path}` (e.g. workspace `/Users/me/Scenes` + `@ scenes/my-scene` → `/Users/me/Scenes/scenes/my-scene/`). Cwd need not be the workspace.
4. `scenes validate [id]` often — same block format; failures are `- path: message` lines.
5. `list` = meta only (no `setup`).

## Skeleton

```bash
mkdir -p scenes/my-scene
```

`metadata.json`:

```json
{
  "title": "My scene",
  "description": "TODO",
  "tags": []
}
```

`scene.js`:

```js
import * as THREE from "three";

export function setup(ctx) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x88aaff }),
  );
  mesh.name = "box";
  ctx.root.add(mesh);
}
```

`scenes validate my-scene`

## Later (stubs)

- **show**: local viewer; reload browser after edits  
- **tools**: axes/grid — runtime-owned  
- **camera**: by `dimensions` — 3 orbit/fly, 2 pan/zoom  
- **params UI**, annotations+LaTeX, object `name`s  
- **attribution**: optional showcase catalog  

## Out of scope now

`update`/animation, snapshots, collections, publish, `scenes new`
