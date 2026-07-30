import * as THREE from "three";

export const runtime = {
  lights: false,
  helpers: false,
  camera: false,
  playback: true,
};

// ─── module state (survives remount; input + fly rig) ───────────────────────
const fly = {
  yaw: 0.35,
  pitch: -0.12,
  vel: new THREE.Vector3(),
  keys: Object.create(null),
  pointerLocked: false,
  inited: false,
  bound: false,
  listeners: null,
  tmpF: new THREE.Vector3(),
  tmpR: new THREE.Vector3(),
  tmpU: new THREE.Vector3(),
  euler: new THREE.Euler(0, 0, 0, "YXZ"),
  bodies: null,
  trails: null,
  belt: null,
  stars: null,
  sunCore: null,
  sunGlow: null,
  sunCorona: null,
  sunLight: null,
  labelNodes: [],
  orbitLines: [],
};

const PLANETS = [
  {
    id: "mercury",
    name: "Mercury",
    color: 0xb5b5b5,
    emissive: 0x222222,
    r: 0.38,
    dist: 12,
    period: 0.24,
    spin: 0.02,
    tilt: 0.03,
    segs: 48,
    metalness: 0.55,
    roughness: 0.45,
  },
  {
    id: "venus",
    name: "Venus",
    color: 0xe8c87a,
    emissive: 0x3a2a08,
    r: 0.72,
    dist: 18,
    period: 0.62,
    spin: -0.008,
    tilt: 3.1,
    segs: 56,
    metalness: 0.15,
    roughness: 0.55,
    atmosphere: 0xffcc66,
  },
  {
    id: "earth",
    name: "Earth",
    color: 0x2a6fd6,
    emissive: 0x061830,
    r: 0.78,
    dist: 26,
    period: 1,
    spin: 0.06,
    tilt: 0.41,
    segs: 64,
    metalness: 0.2,
    roughness: 0.45,
    atmosphere: 0x66b3ff,
    land: 0x2d8a4e,
  },
  {
    id: "mars",
    name: "Mars",
    color: 0xc1440e,
    emissive: 0x2a0c04,
    r: 0.52,
    dist: 36,
    period: 1.88,
    spin: 0.055,
    tilt: 0.44,
    segs: 48,
    metalness: 0.25,
    roughness: 0.7,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    color: 0xd4a574,
    emissive: 0x2a1810,
    r: 3.2,
    dist: 58,
    period: 11.86,
    spin: 0.14,
    tilt: 0.05,
    segs: 72,
    metalness: 0.1,
    roughness: 0.55,
    bands: true,
  },
  {
    id: "saturn",
    name: "Saturn",
    color: 0xe8d4a0,
    emissive: 0x2a2410,
    r: 2.7,
    dist: 82,
    period: 29.46,
    spin: 0.12,
    tilt: 0.47,
    segs: 72,
    metalness: 0.12,
    roughness: 0.5,
    rings: true,
  },
  {
    id: "uranus",
    name: "Uranus",
    color: 0x7de8e8,
    emissive: 0x0a3030,
    r: 1.5,
    dist: 108,
    period: 84.0,
    spin: 0.09,
    tilt: 1.71,
    segs: 56,
    metalness: 0.2,
    roughness: 0.35,
    atmosphere: 0xaaffff,
  },
  {
    id: "neptune",
    name: "Neptune",
    color: 0x3b5bdb,
    emissive: 0x081838,
    r: 1.45,
    dist: 132,
    period: 164.8,
    spin: 0.1,
    tilt: 0.49,
    segs: 56,
    metalness: 0.22,
    roughness: 0.4,
    atmosphere: 0x4488ff,
  },
];

const MOON = {
  id: "moon",
  name: "Moon",
  color: 0xc8c4b8,
  emissive: 0x1a1a18,
  r: 0.22,
  dist: 2.1,
  period: 0.0748,
  spin: 0.01,
  segs: 32,
  metalness: 0.15,
  roughness: 0.85,
};

// ─── params ─────────────────────────────────────────────────────────────────
export function params() {
  return [
    {
      type: "card",
      title: "Flight",
      children: [
        {
          type: "note",
          text: "Click the canvas for mouse-look. W/A/S/D thrust · Space up · Ctrl down · Shift boost · C reset near Earth. Orbits pause with host Play/Pause; flight always runs.",
        },
        {
          key: "fly_speed",
          type: "number",
          label: "Cruise speed",
          min: 2,
          max: 80,
          step: 1,
          default: 18,
          unit: "u/s",
        },
        {
          key: "boost_mult",
          type: "number",
          label: "Boost multiplier",
          min: 1.5,
          max: 8,
          step: 0.1,
          default: 3.5,
        },
        {
          key: "look_sens",
          type: "number",
          label: "Look sensitivity",
          min: 0.0005,
          max: 0.01,
          step: 0.0005,
          default: 0.0022,
        },
        {
          key: "drag",
          type: "number",
          label: "Velocity drag",
          min: 0.85,
          max: 0.995,
          step: 0.005,
          default: 0.94,
        },
      ],
    },
    {
      type: "card",
      title: "Simulation",
      children: [
        {
          key: "time_scale",
          type: "number",
          label: "Orbit time scale",
          min: 0.1,
          max: 8,
          step: 0.1,
          default: 1,
          unit: "×",
        },
        {
          key: "eccentricity",
          type: "number",
          label: "Orbit eccentricity",
          min: 0,
          max: 0.35,
          step: 0.01,
          default: 0.04,
        },
        {
          key: "show_orbits",
          type: "boolean",
          label: "Orbit trails",
          default: true,
        },
        {
          key: "show_labels",
          type: "boolean",
          label: "Body labels",
          default: true,
        },
        {
          key: "show_belt",
          type: "boolean",
          label: "Asteroid belt",
          default: true,
        },
        {
          key: "show_stars",
          type: "boolean",
          label: "Starfield",
          default: true,
        },
      ],
    },
    {
      type: "card",
      title: "Visuals",
      children: [
        {
          key: "sun_power",
          type: "number",
          label: "Sun light power",
          min: 20,
          max: 400,
          step: 5,
          default: 140,
        },
        {
          key: "sun_size",
          type: "number",
          label: "Sun radius",
          min: 2,
          max: 10,
          step: 0.25,
          default: 6,
          unit: "u",
        },
        {
          key: "glow",
          type: "number",
          label: "Corona intensity",
          min: 0.2,
          max: 2.5,
          step: 0.05,
          default: 1,
        },
        {
          key: "planet_scale",
          type: "number",
          label: "Planet size scale",
          min: 0.4,
          max: 2.5,
          step: 0.05,
          default: 1,
        },
        {
          key: "star_count",
          type: "number",
          label: "Star count",
          min: 1000,
          max: 16000,
          step: 500,
          default: 10000,
        },
        {
          key: "belt_count",
          type: "number",
          label: "Asteroid count",
          min: 200,
          max: 4000,
          step: 100,
          default: 2000,
        },
        {
          key: "quality",
          type: "select",
          label: "Mesh quality",
          options: ["draft", "high", "ultra"],
          default: "high",
        },
      ],
    },
    {
      type: "card",
      title: "Bodies",
      children: [
        {
          key: "visible_bodies",
          type: "multiselect",
          label: "Show",
          options: [
            "mercury",
            "venus",
            "earth",
            "mars",
            "jupiter",
            "saturn",
            "uranus",
            "neptune",
            "moon",
          ],
          default: [
            "mercury",
            "venus",
            "earth",
            "mars",
            "jupiter",
            "saturn",
            "uranus",
            "neptune",
            "moon",
          ],
        },
        {
          type: "label",
          label: "System span",
          value: () => "~264 u diameter (Neptune orbit)",
        },
      ],
    },
  ];
}

export function onParamsChange(params) {
  return params;
}

export function validateParams(params) {
  const issues = [];
  if ((params.fly_speed ?? 0) < 1) {
    issues.push({ key: "fly_speed", message: "cruise speed should be ≥ 1" });
  }
  return issues;
}

// ─── helpers ────────────────────────────────────────────────────────────────
function segMul(quality) {
  if (quality === "ultra") return 1.5;
  if (quality === "draft") return 0.55;
  return 1;
}

function seeded(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeStarfield(count, radius) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = seeded(i, 1);
    const v = seeded(i, 2);
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.55 + 0.45 * seeded(i, 3));
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    const tint = seeded(i, 4);
    const b = 0.65 + 0.35 * seeded(i, 5);
    if (tint < 0.12) {
      col[i * 3] = 0.65 * b;
      col[i * 3 + 1] = 0.78 * b;
      col[i * 3 + 2] = 1.0 * b;
    } else if (tint < 0.22) {
      col[i * 3] = 1.0 * b;
      col[i * 3 + 1] = 0.72 * b;
      col[i * 3 + 2] = 0.45 * b;
    } else {
      col[i * 3] = b;
      col[i * 3 + 1] = b;
      col[i * 3 + 2] = b * (0.92 + 0.08 * seeded(i, 6));
    }
    sizes[i] = 0.6 + 2.4 * Math.pow(seeded(i, 7), 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.55,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = "starfield";
  pts.frustumCulled = false;
  return pts;
}

function makeOrbitLine(a, e, color, segments = 180) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const th = (i / segments) * Math.PI * 2;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(th));
    pts.push(new THREE.Vector3(Math.cos(th) * r, 0, Math.sin(th) * r));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.name = "orbit";
  return line;
}

function bandTexture(baseHex, seed = 1) {
  const w = 256;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const base = new THREE.Color(baseHex);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    const n =
      0.5 +
      0.5 *
        Math.sin(y * 0.18 + seed) *
        Math.sin(y * 0.07 + seed * 2.1) *
        Math.sin(y * 0.41);
    const shade = 0.55 + 0.55 * n;
    const col = base.clone().multiplyScalar(shade);
    if (seed % 2 === 1 && y % 17 < 3) col.offsetHSL(0.02, 0.1, 0.08);
    ctx.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
    ctx.fillRect(0, y, w, 1);
  }
  // swirls
  for (let i = 0; i < 40; i++) {
    const x = seeded(i, seed + 20) * w;
    const y = seeded(i, seed + 30) * h;
    const rw = 8 + seeded(i, seed + 40) * 40;
    const rh = 2 + seeded(i, seed + 50) * 8;
    ctx.fillStyle = `rgba(255,220,180,${0.04 + 0.08 * seeded(i, seed + 60)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, seeded(i, seed + 70) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function earthTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a4fa8";
  ctx.fillRect(0, 0, w, h);
  // continents — noise blobs
  for (let i = 0; i < 180; i++) {
    const x = seeded(i, 100) * w;
    const y = 20 + seeded(i, 101) * (h - 40);
    const rw = 12 + seeded(i, 102) * 55;
    const rh = 8 + seeded(i, 103) * 30;
    const g = 40 + ((seeded(i, 104) * 90) | 0);
    const r = 20 + ((seeded(i, 105) * 50) | 0);
    ctx.fillStyle = `rgb(${r},${g},${30 + ((seeded(i, 106) * 40) | 0)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rw, rh, seeded(i, 107) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // ice caps
  const gradN = ctx.createLinearGradient(0, 0, 0, 28);
  gradN.addColorStop(0, "rgba(240,248,255,0.95)");
  gradN.addColorStop(1, "rgba(240,248,255,0)");
  ctx.fillStyle = gradN;
  ctx.fillRect(0, 0, w, 28);
  const gradS = ctx.createLinearGradient(0, h, 0, h - 28);
  gradS.addColorStop(0, "rgba(240,248,255,0.95)");
  gradS.addColorStop(1, "rgba(240,248,255,0)");
  ctx.fillStyle = gradS;
  ctx.fillRect(0, h - 28, w, 28);
  // clouds hints
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.08 * seeded(i, 200)})`;
    ctx.beginPath();
    ctx.ellipse(
      seeded(i, 201) * w,
      seeded(i, 202) * h,
      10 + seeded(i, 203) * 40,
      3 + seeded(i, 204) * 8,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunTexture() {
  const w = 256;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n =
        0.55 +
        0.25 * Math.sin(x * 0.12 + y * 0.07) +
        0.2 * Math.sin(x * 0.31 - y * 0.19) +
        0.15 * Math.sin((x + y) * 0.08);
      const flare = Math.pow(Math.max(0, n), 1.4);
      img.data[i] = Math.min(255, 220 + flare * 35);
      img.data[i + 1] = Math.min(255, 120 + flare * 90);
      img.data[i + 2] = Math.min(255, 20 + flare * 40);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsteroidBelt(count, inner, outer) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a7a68,
    roughness: 0.92,
    metalness: 0.15,
    flatShading: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = "asteroid-belt";
  const dummy = new THREE.Object3D();
  const data = new Float32Array(count * 4); // a, phase, y, spin
  for (let i = 0; i < count; i++) {
    const a = inner + seeded(i, 1) * (outer - inner);
    const phase = seeded(i, 2) * Math.PI * 2;
    const y = (seeded(i, 3) - 0.5) * 2.2;
    const s = 0.04 + seeded(i, 4) * 0.18;
    const e = 0.02 + seeded(i, 5) * 0.08;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(phase));
    dummy.position.set(Math.cos(phase) * r, y, Math.sin(phase) * r);
    dummy.rotation.set(
      seeded(i, 6) * Math.PI,
      seeded(i, 7) * Math.PI,
      seeded(i, 8) * Math.PI
    );
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    data[i * 4] = a;
    data[i * 4 + 1] = phase;
    data[i * 4 + 2] = y;
    data[i * 4 + 3] = 0.2 + seeded(i, 9) * 1.5;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.userData.belt = data;
  mesh.userData.inner = inner;
  mesh.userData.outer = outer;
  mesh.userData.count = count;
  mesh.userData.dummy = dummy;
  return mesh;
}

function makeSun(size, glow, power) {
  const group = new THREE.Group();
  group.name = "sun";

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(size, 64, 64),
    new THREE.MeshBasicMaterial({
      map: sunTexture(),
      color: 0xffeeaa,
    })
  );
  core.name = "sun-core";
  group.add(core);

  // inner hot shell
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(size * 1.04, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.35 * glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  group.add(shell);

  // corona shells
  const coronaMats = [];
  for (let i = 0; i < 4; i++) {
    const s = size * (1.15 + i * 0.28);
    const m = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xff8800 : 0xffcc44,
      transparent: true,
      opacity: (0.12 - i * 0.02) * glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    coronaMats.push(m);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 32, 32), m);
    mesh.name = `corona-${i}`;
    group.add(mesh);
  }

  // equatorial flare disc
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(size * 1.05, size * 2.4, 64),
    new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.18 * glow,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const light = new THREE.PointLight(0xfff0d0, power, 0, 1.15);
  light.position.set(0, 0, 0);
  group.add(light);

  // soft ambient fill so dark sides aren't pure black
  const fill = new THREE.AmbientLight(0x1a2238, 0.35);
  group.add(fill);
  const hemi = new THREE.HemisphereLight(0x2040a0, 0x080808, 0.25);
  group.add(hemi);

  group.userData.core = core;
  group.userData.shell = shell;
  group.userData.coronaMats = coronaMats;
  group.userData.disc = disc;
  group.userData.light = light;
  group.userData.size = size;
  return group;
}

function makePlanet(def, scale, quality, visible) {
  const segs = Math.max(12, Math.round(def.segs * segMul(quality)));
  const group = new THREE.Group();
  group.name = def.id;
  group.visible = visible;

  let map = null;
  if (def.id === "earth") map = earthTexture();
  else if (def.bands) map = bandTexture(def.color, def.id === "jupiter" ? 1 : 3);
  else if (def.id === "saturn") map = bandTexture(def.color, 2);

  const mat = new THREE.MeshStandardMaterial({
    color: map ? 0xffffff : def.color,
    map: map || null,
    emissive: def.emissive ?? 0x000000,
    emissiveIntensity: 0.35,
    metalness: def.metalness ?? 0.2,
    roughness: def.roughness ?? 0.5,
  });
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(def.r * scale, segs, segs),
    mat
  );
  body.castShadow = false;
  body.receiveShadow = false;
  body.name = `${def.id}-body`;
  group.add(body);

  if (def.atmosphere) {
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(def.r * scale * 1.06, segs, segs),
      new THREE.MeshBasicMaterial({
        color: def.atmosphere,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      })
    );
    atm.name = `${def.id}-atm`;
    group.add(atm);
  }

  if (def.rings) {
    const rings = new THREE.Mesh(
      new THREE.RingGeometry(def.r * scale * 1.35, def.r * scale * 2.35, 96),
      new THREE.MeshStandardMaterial({
        color: 0xd8c8a0,
        metalness: 0.25,
        roughness: 0.65,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );
    rings.rotation.x = Math.PI / 2;
    // subtle ring color variation via second ring
    const rings2 = new THREE.Mesh(
      new THREE.RingGeometry(def.r * scale * 1.55, def.r * scale * 1.72, 96),
      new THREE.MeshBasicMaterial({
        color: 0x1a1410,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    rings2.rotation.x = Math.PI / 2;
    const ringGroup = new THREE.Group();
    ringGroup.name = "saturn-rings";
    ringGroup.add(rings);
    ringGroup.add(rings2);
    ringGroup.rotation.z = def.tilt * 0.35;
    group.add(ringGroup);
  }

  // axial tilt on body group child
  const tilted = new THREE.Group();
  tilted.name = `${def.id}-tilt`;
  // reparent body pieces into tilt? simpler: rotate group in update for spin on tilted axis
  group.userData.def = def;
  group.userData.body = body;
  group.userData.spin = 0;
  group.userData.scale = scale;
  group.rotation.z = def.tilt ?? 0;

  return group;
}

function makeMoon(scale, quality, visible) {
  const segs = Math.max(12, Math.round(MOON.segs * segMul(quality)));
  const group = new THREE.Group();
  group.name = "moon";
  group.visible = visible;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(MOON.r * scale, segs, segs),
    new THREE.MeshStandardMaterial({
      color: MOON.color,
      emissive: MOON.emissive,
      emissiveIntensity: 0.25,
      metalness: MOON.metalness,
      roughness: MOON.roughness,
      flatShading: quality === "draft",
    })
  );
  group.add(body);
  group.userData.def = MOON;
  group.userData.body = body;
  group.userData.spin = 0;
  return group;
}

function detachFlyListeners() {
  if (!fly.listeners) return;
  const { el, onKeyDown, onKeyUp, onMouseMove, onClick, onLockChange, onBlur } =
    fly.listeners;
  el.removeEventListener("keydown", onKeyDown);
  el.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("mousemove", onMouseMove);
  el.removeEventListener("click", onClick);
  document.removeEventListener("pointerlockchange", onLockChange);
  window.removeEventListener("blur", onBlur);
  fly.listeners = null;
  fly.bound = false;
}

function bindFly(host) {
  detachFlyListeners();
  const el = host.domElement;
  if (!el) return;
  el.tabIndex = 0;
  el.style.outline = "none";

  const onKeyDown = (e) => {
    // do not steal host R / /
    if (e.key === "r" || e.key === "R" || e.key === "/") return;
    fly.keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyC") {
      // reset near Earth
      const earth = fly.bodies?.get("earth");
      if (earth) {
        const p = earth.position;
        host.camera.position.set(p.x + 4.5, p.y + 1.8, p.z + 5.5);
        fly.yaw = Math.atan2(
          p.x - host.camera.position.x,
          p.z - host.camera.position.z
        );
        fly.pitch = -0.18;
        fly.vel.set(0, 0, 0);
      }
    }
  };
  const onKeyUp = (e) => {
    fly.keys[e.code] = false;
  };
  const onMouseMove = (e) => {
    if (!fly.pointerLocked) return;
    const sens = host.params?.look_sens ?? 0.0022;
    fly.yaw -= e.movementX * sens;
    fly.pitch -= e.movementY * sens;
    const lim = Math.PI / 2 - 0.05;
    fly.pitch = Math.max(-lim, Math.min(lim, fly.pitch));
  };
  const onClick = () => {
    if (document.pointerLockElement !== el) {
      el.requestPointerLock?.();
    }
    el.focus?.();
  };
  const onLockChange = () => {
    fly.pointerLocked = document.pointerLockElement === el;
  };
  const onBlur = () => {
    for (const k of Object.keys(fly.keys)) fly.keys[k] = false;
  };

  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("keyup", onKeyUp);
  document.addEventListener("mousemove", onMouseMove);
  el.addEventListener("click", onClick);
  document.addEventListener("pointerlockchange", onLockChange);
  window.addEventListener("blur", onBlur);

  fly.listeners = {
    el,
    onKeyDown,
    onKeyUp,
    onMouseMove,
    onClick,
    onLockChange,
    onBlur,
  };
  fly.bound = true;
}

function keplerRadius(a, e, theta) {
  return (a * (1 - e * e)) / (1 + e * Math.cos(theta));
}

// ─── setup ──────────────────────────────────────────────────────────────────
export function setup(host) {
  const p = host.params;
  const quality = p.quality ?? "high";
  const pScale = p.planet_scale ?? 1;
  const sunSize = p.sun_size ?? 6;
  const visible = new Set(
    Array.isArray(p.visible_bodies) ? p.visible_bodies : []
  );
  const e = p.eccentricity ?? 0.04;

  // clear module scene refs (root is cleared by host)
  fly.bodies = new Map();
  fly.trails = [];
  fly.labelNodes = [];
  fly.orbitLines = [];
  fly.belt = null;
  fly.stars = null;

  // space backdrop via scene fog-ish dark — host owns scene bg; use huge sphere
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x02040c,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  sky.name = "sky-dome";
  host.root.add(sky);

  if (p.show_stars !== false) {
    const stars = makeStarfield(Math.floor(p.star_count ?? 10000), 700);
    host.root.add(stars);
    fly.stars = stars;
  }

  const sun = makeSun(sunSize, p.glow ?? 1, p.sun_power ?? 140);
  host.root.add(sun);
  fly.sunCore = sun.userData.core;
  fly.sunGlow = sun.userData.shell;
  fly.sunCorona = sun;
  fly.sunLight = sun.userData.light;

  if (p.show_labels !== false) {
    const sunLbl = new THREE.Object3D();
    sunLbl.position.set(0, sunSize + 1.2, 0);
    sunLbl.userData.annotation = "Sun — $1.99\\times 10^{30}\\,\\mathrm{kg}$";
    sunLbl.name = "label-sun";
    host.root.add(sunLbl);
    fly.labelNodes.push(sunLbl);
  }

  // planets
  for (const def of PLANETS) {
    const show = visible.has(def.id);
    const g = makePlanet(def, pScale, quality, show);
    host.root.add(g);
    fly.bodies.set(def.id, g);

    if (p.show_orbits !== false) {
      const col = new THREE.Color(def.color).multiplyScalar(0.85);
      const orbit = makeOrbitLine(def.dist, e, col.getHex(), quality === "draft" ? 96 : 192);
      orbit.visible = show;
      host.root.add(orbit);
      fly.orbitLines.push({ line: orbit, id: def.id });
    }

    if (p.show_labels !== false && show) {
      const lbl = new THREE.Object3D();
      lbl.userData.annotation = def.name;
      lbl.name = `label-${def.id}`;
      host.root.add(lbl);
      fly.labelNodes.push(lbl);
      g.userData.label = lbl;
    }
  }

  // moon (orbits Earth)
  if (visible.has("moon") || visible.has("earth")) {
    const moon = makeMoon(pScale, quality, visible.has("moon"));
    host.root.add(moon);
    fly.bodies.set("moon", moon);
    if (p.show_labels !== false && visible.has("moon")) {
      const lbl = new THREE.Object3D();
      lbl.userData.annotation = "Moon";
      lbl.name = "label-moon";
      host.root.add(lbl);
      fly.labelNodes.push(lbl);
      moon.userData.label = lbl;
    }
  }

  // asteroid belt between Mars and Jupiter
  if (p.show_belt !== false) {
    const belt = makeAsteroidBelt(
      Math.floor(p.belt_count ?? 2000),
      42,
      52
    );
    host.root.add(belt);
    fly.belt = belt;
  }

  // faint ecliptic grid ring (showcase polish)
  const ecliptic = new THREE.Mesh(
    new THREE.RingGeometry(10, 140, 128),
    new THREE.MeshBasicMaterial({
      color: 0x2244aa,
      transparent: true,
      opacity: 0.035,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ecliptic.rotation.x = -Math.PI / 2;
  ecliptic.name = "ecliptic";
  host.root.add(ecliptic);

  // initial camera (once)
  if (!fly.inited) {
    host.camera.position.set(32, 10, 38);
    fly.yaw = 0.55;
    fly.pitch = -0.15;
    fly.vel.set(0, 0, 0);
    fly.inited = true;
  }
  host.camera.near = 0.05;
  host.camera.far = 2500;
  host.camera.updateProjectionMatrix?.();
  applyCameraOrientation(host);

  bindFly(host);

  // store live params snapshot for onFrame
  host.root.userData.p = p;
}

function applyCameraOrientation(host) {
  fly.euler.set(fly.pitch, fly.yaw, 0);
  host.camera.quaternion.setFromEuler(fly.euler);
}

// ─── sim (pausable) ─────────────────────────────────────────────────────────
export function update(host, t, dt) {
  const p = host.params;
  const e = p.eccentricity ?? 0.04;
  const ts = (p.time_scale ?? 1) / 5;
  // mean motion scale: Earth period ≈ 10π host-seconds at time_scale 1
  const phase = t * ts;

  for (const def of PLANETS) {
    const g = fly.bodies?.get(def.id);
    if (!g) continue;
    const theta = phase / def.period;
    const r = keplerRadius(def.dist, e, theta);
    g.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
    g.userData.spin = (g.userData.spin ?? 0) + def.spin * ts * dt;
    if (g.userData.body) g.userData.body.rotation.y = g.userData.spin;

    if (g.userData.label) {
      const lift = (def.r * (p.planet_scale ?? 1)) + 0.55;
      g.userData.label.position.set(g.position.x, g.position.y + lift, g.position.z);
    }
  }

  // moon around earth
  const earth = fly.bodies?.get("earth");
  const moon = fly.bodies?.get("moon");
  if (earth && moon) {
    const th = phase / MOON.period;
    const mr = MOON.dist * (p.planet_scale ?? 1);
    moon.position.set(
      earth.position.x + Math.cos(th) * mr,
      earth.position.y + Math.sin(th * 0.3) * mr * 0.08,
      earth.position.z + Math.sin(th) * mr
    );
    moon.userData.spin = (moon.userData.spin ?? 0) + MOON.spin * ts * dt;
    if (moon.userData.body) moon.userData.body.rotation.y = moon.userData.spin;
    if (moon.userData.label) {
      moon.userData.label.position.set(
        moon.position.x,
        moon.position.y + MOON.r * (p.planet_scale ?? 1) + 0.35,
        moon.position.z
      );
    }
  }

  // asteroid belt slow drift
  if (fly.belt) {
    const data = fly.belt.userData.belt;
    const dummy = fly.belt.userData.dummy;
    const n = fly.belt.userData.count;
    const ee = 0.04;
    for (let i = 0; i < n; i++) {
      const a = data[i * 4];
      let ph = data[i * 4 + 1] + dt * ts * (0.08 / Math.sqrt(a / 40));
      data[i * 4 + 1] = ph;
      const y = data[i * 4 + 2];
      const r = keplerRadius(a, ee, ph);
      dummy.position.set(Math.cos(ph) * r, y, Math.sin(ph) * r);
      dummy.rotation.x += dt * data[i * 4 + 3] * 0.2;
      dummy.rotation.y += dt * data[i * 4 + 3] * 0.15;
      // keep scale from initial — re-read matrix scale is heavy; re-apply from seed
      const s = 0.04 + seeded(i, 4) * 0.18;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      fly.belt.setMatrixAt(i, dummy.matrix);
    }
    fly.belt.instanceMatrix.needsUpdate = true;
  }

  // sun pulse
  if (fly.sunCorona) {
    const pulse = 1 + 0.03 * Math.sin(t * 1.7) + 0.015 * Math.sin(t * 4.3);
    fly.sunCorona.scale.setScalar(pulse);
    if (fly.sunLight) {
      fly.sunLight.intensity = (p.sun_power ?? 140) * (0.92 + 0.08 * Math.sin(t * 2.1));
    }
  }
}

// ─── free-fly every frame (incl. pause) ─────────────────────────────────────
export function onFrame(host, dt) {
  if (!host.camera || !host.domElement) return;
  // rebind if canvas swapped
  if (!fly.bound || fly.listeners?.el !== host.domElement) {
    bindFly(host);
  }

  const p = host.params;
  const speed = p.fly_speed ?? 18;
  const boost = p.boost_mult ?? 3.5;
  const drag = p.drag ?? 0.94;
  const keys = fly.keys;

  applyCameraOrientation(host);

  // basis from camera
  host.camera.getWorldDirection(fly.tmpF);
  fly.tmpR.crossVectors(fly.tmpF, host.camera.up).normalize();
  // if looking straight up/down, fall back
  if (fly.tmpR.lengthSq() < 1e-6) {
    fly.tmpR.set(1, 0, 0).applyQuaternion(host.camera.quaternion);
  }
  fly.tmpU.crossVectors(fly.tmpR, fly.tmpF).normalize();

  let mx = 0;
  let my = 0;
  let mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz += 1;
  if (keys.KeyS || keys.ArrowDown) mz -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.Space) my += 1;
  if (keys.ControlLeft || keys.ControlRight || keys.KeyQ) my -= 1;
  // also KeyE for up alternate
  if (keys.KeyE) my += 1;

  const len = Math.hypot(mx, my, mz);
  if (len > 0) {
    mx /= len;
    my /= len;
    mz /= len;
  }

  let sp = speed;
  if (keys.ShiftLeft || keys.ShiftRight) sp *= boost;

  // acceleration toward wish dir
  const accel = sp * 3.2;
  fly.vel.addScaledVector(fly.tmpR, mx * accel * dt);
  fly.vel.addScaledVector(fly.tmpU, my * accel * dt);
  fly.vel.addScaledVector(fly.tmpF, mz * accel * dt);

  // drag (frame-rate aware-ish)
  const d = Math.pow(drag, dt * 60);
  fly.vel.multiplyScalar(d);

  // cap speed
  const maxSp = sp * 1.8;
  if (fly.vel.length() > maxSp) fly.vel.setLength(maxSp);

  host.camera.position.addScaledVector(fly.vel, dt);

  // soft boundary — bounce gently if leaving system
  const pos = host.camera.position;
  const lim = 420;
  if (pos.length() > lim) {
    pos.setLength(lim * 0.98);
    fly.vel.multiplyScalar(-0.3);
  }

  // gentle auto starfield rotation for life
  if (fly.stars) {
    fly.stars.rotation.y += dt * 0.003;
  }
}
