import * as THREE from "three";

export const runtime = { lights: true, helpers: false, camera: true, playback: true };

const DEG = Math.PI / 180;
const BOB_R = 0.045;
const PIVOT = new THREE.Vector3(0, 0.55, 0);

function heightDrop(L, theta0Rad) {
  return L * (1 - Math.cos(theta0Rad));
}

function speedAtBottom(L, theta0Rad, g) {
  // mgh = ½mv²  with  h = L(1 − cos θ₀)
  return Math.sqrt(2 * g * heightDrop(L, theta0Rad));
}

function tensionAtBottom(m, L, theta0Rad, g) {
  // T − mg = mv²/L  ⇒  T = m(g + v²/L) = mg(3 − 2 cos θ₀)
  const v2 = 2 * g * heightDrop(L, theta0Rad);
  return m * (g + v2 / L);
}

function periodApprox(L, g, theta0Rad) {
  // large-angle approx (first correction)
  const K = 1 + (1 / 16) * theta0Rad * theta0Rad;
  return 2 * Math.PI * Math.sqrt(L / g) * K;
}

function bobPos(theta, L) {
  // θ = 0 is down (vertical). θ > 0 swings toward +X.
  return new THREE.Vector3(
    PIVOT.x + L * Math.sin(theta),
    PIVOT.y - L * Math.cos(theta),
    0
  );
}

function makeArc(radius, a0, a1, segs, color, yLift = 0) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs);
    // polar angle from downward vertical, in XY
    pts.push(new THREE.Vector3(
      PIVOT.x + radius * Math.sin(a),
      PIVOT.y - radius * Math.cos(a) + yLift,
      0
    ));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
}

function dashedLine(a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.04,
    gapSize: 0.025,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  return line;
}

export function setup(host) {
  const p = host.params;
  const L = p.L ?? 0.8;
  const m = p.m ?? 0.25;
  const theta0Deg = p.theta0 ?? 30;
  const g = p.g ?? 9.8;
  const theta0 = theta0Deg * DEG;
  const showEnergy = p.show_energy !== false;
  const showHeight = p.show_height !== false;
  const showForces = p.show_forces !== false;
  const showTrail = p.show_trail !== false;

  const h = heightDrop(L, theta0);
  const vBot = speedAtBottom(L, theta0, g);
  const TBot = tensionAtBottom(m, L, theta0, g);

  // store for update + labels
  host.root.userData.sim = {
    L,
    m,
    g,
    theta0,
    theta: theta0,
    omega: 0,
    vBot,
    TBot,
    h,
    showForces,
    showTrail,
    trail: [],
    maxTrail: 80,
  };

  // pivot block
  const pivotMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.3, roughness: 0.5 })
  );
  pivotMesh.position.copy(PIVOT).add(new THREE.Vector3(0, 0.03, 0));
  pivotMesh.name = "pivot";
  host.root.add(pivotMesh);

  const pivotPin = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  pivotPin.position.copy(PIVOT);
  host.root.add(pivotPin);

  // string
  const releasePos = bobPos(theta0, L);
  const stringGeo = new THREE.BufferGeometry().setFromPoints([PIVOT.clone(), releasePos.clone()]);
  const string = new THREE.Line(
    stringGeo,
    new THREE.LineBasicMaterial({ color: 0x1e293b, linewidth: 2 })
  );
  string.name = "string";
  host.root.add(string);

  // bob
  const bob = new THREE.Mesh(
    new THREE.SphereGeometry(BOB_R, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.15, roughness: 0.45 })
  );
  bob.position.copy(releasePos);
  bob.name = "bob";
  host.root.add(bob);

  // equilibrium vertical (dashed)
  const bottomPos = bobPos(0, L);
  host.root.add(dashedLine(PIVOT.clone(), bottomPos.clone(), 0x94a3b8));

  // release ray (faint)
  host.root.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([PIVOT.clone(), releasePos.clone()]),
      new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5 })
    )
  );

  // angle arc near pivot
  const arcR = Math.min(0.22, L * 0.28);
  host.root.add(makeArc(arcR, 0, theta0, 24, 0x0ea5e9));

  const angLabel = new THREE.Object3D();
  const midA = theta0 / 2;
  angLabel.position.set(
    PIVOT.x + (arcR + 0.08) * Math.sin(midA),
    PIVOT.y - (arcR + 0.08) * Math.cos(midA),
    0
  );
  angLabel.userData.annotation = `$\\theta_0 = ${theta0Deg}^\\circ$`;
  angLabel.name = "theta0-label";
  host.root.add(angLabel);

  // height drop graphic: horizontal from release bob to vertical line, vertical segment h
  if (showHeight) {
    const dropTop = new THREE.Vector3(0, releasePos.y, 0); // on vertical axis at release height
    const dropBot = bottomPos.clone();
    host.root.add(dashedLine(releasePos.clone(), dropTop.clone(), 0xa78bfa));
    host.root.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([dropTop, dropBot]),
        new THREE.LineBasicMaterial({ color: 0x8b5cf6 })
      )
    );
    // small end caps
    const cap = (y) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.04, y, 0),
        new THREE.Vector3(0.04, y, 0),
      ]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8b5cf6 }));
    };
    host.root.add(cap(dropTop.y));
    host.root.add(cap(dropBot.y));

    const hLab = new THREE.Object3D();
    hLab.position.set(0.12, (dropTop.y + dropBot.y) / 2, 0);
    hLab.userData.annotation = `$h = L(1-\\cos\\theta_0) = ${h.toFixed(3)}\\,\\mathrm{m}$`;
    hLab.name = "h-label";
    host.root.add(hLab);

    const relLab = new THREE.Object3D();
    relLab.position.copy(releasePos).add(new THREE.Vector3(0.12, 0.06, 0));
    relLab.userData.annotation = "release (rest)";
    host.root.add(relLab);
  }

  // bottom marker
  const botMark = new THREE.Mesh(
    new THREE.RingGeometry(BOB_R * 1.15, BOB_R * 1.35, 32),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
  );
  botMark.position.copy(bottomPos);
  botMark.name = "bottom-ring";
  host.root.add(botMark);

  const botLab = new THREE.Object3D();
  botLab.position.copy(bottomPos).add(new THREE.Vector3(0.14, -0.08, 0));
  botLab.userData.annotation = "bottom";
  botLab.name = "bottom-label";
  host.root.add(botLab);

  // energy readout (static formula board near top-left of content)
  if (showEnergy) {
    const e1 = new THREE.Object3D();
    e1.position.set(-0.95, 0.35, 0);
    e1.userData.annotation =
      `$\\Delta E=0:\\; mgh = \\tfrac12 mv^2$`;
    e1.name = "energy-1";
    host.root.add(e1);

    const e2 = new THREE.Object3D();
    e2.position.set(-0.95, 0.18, 0);
    e2.userData.annotation =
      `$v = \\sqrt{2gL(1-\\cos\\theta_0)} = ${vBot.toFixed(3)}\\,\\mathrm{m/s}$`;
    e2.name = "energy-2";
    host.root.add(e2);

    const e3 = new THREE.Object3D();
    e3.position.set(-0.95, 0.01, 0);
    e3.userData.annotation =
      `$T = m\\!\\left(g + \\dfrac{v^2}{L}\\right) = ${TBot.toFixed(3)}\\,\\mathrm{N}$`;
    e3.name = "energy-3";
    host.root.add(e3);
  }

  // force / velocity arrows at bottom (reference solution state)
  if (showForces) {
    const arrowLenV = Math.min(0.35, 0.12 + 0.1 * vBot);
    // velocity is horizontal at bottom (to +X when swinging from +θ)
    const vDir = new THREE.Vector3(1, 0, 0);
    const vArrow = new THREE.ArrowHelper(
      vDir,
      bottomPos.clone().add(new THREE.Vector3(0, 0, 0.01)),
      arrowLenV,
      0x2563eb,
      0.06,
      0.04
    );
    vArrow.name = "v-arrow";
    host.root.add(vArrow);

    const vLab = new THREE.Object3D();
    vLab.position.copy(bottomPos).add(new THREE.Vector3(arrowLenV + 0.08, 0.06, 0));
    vLab.userData.annotation = `$\\vec v$`;
    host.root.add(vLab);

    // weight mg down
    const wLen = 0.18;
    const wArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      bottomPos.clone(),
      wLen,
      0xef4444,
      0.05,
      0.035
    );
    wArrow.name = "w-arrow";
    host.root.add(wArrow);

    const wLab = new THREE.Object3D();
    wLab.position.copy(bottomPos).add(new THREE.Vector3(-0.14, -wLen * 0.55, 0));
    wLab.userData.annotation = `$mg$`;
    host.root.add(wLab);

    // tension up along string (at bottom: +Y)
    const tLen = 0.18 * (TBot / (m * g));
    const tArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      bottomPos.clone(),
      Math.min(0.45, tLen),
      0x16a34a,
      0.05,
      0.035
    );
    tArrow.name = "t-arrow";
    host.root.add(tArrow);

    const tLab = new THREE.Object3D();
    tLab.position.copy(bottomPos).add(new THREE.Vector3(0.12, Math.min(0.45, tLen) * 0.6, 0));
    tLab.userData.annotation = `$\\vec T$`;
    host.root.add(tLab);

    const nLab = new THREE.Object3D();
    nLab.position.copy(bottomPos).add(new THREE.Vector3(0.35, -0.22, 0));
    nLab.userData.annotation = `$T - mg = \\dfrac{mv^2}{L}$`;
    host.root.add(nLab);
  }

  // live readouts (updated in update)
  const liveV = new THREE.Object3D();
  liveV.position.set(0.55, 0.45, 0);
  liveV.userData.annotation = `$|\\vec v| = 0.000\\,\\mathrm{m/s}$`;
  liveV.name = "live-v";
  host.root.add(liveV);

  const liveTh = new THREE.Object3D();
  liveTh.position.set(0.55, 0.28, 0);
  liveTh.userData.annotation = `$\\theta = ${theta0Deg.toFixed(1)}^\\circ$`;
  liveTh.name = "live-theta";
  host.root.add(liveTh);

  const liveT = new THREE.Object3D();
  liveT.position.set(0.55, 0.11, 0);
  // T(θ) = mg cosθ + m L ω²  (radial; toward pivot positive for tension)
  const T0 = m * g * Math.cos(theta0); // rest at release: ω=0
  liveT.userData.annotation = `$T(\\theta) = ${T0.toFixed(3)}\\,\\mathrm{N}$`;
  liveT.name = "live-T";
  host.root.add(liveT);

  // trail group
  const trailGroup = new THREE.Group();
  trailGroup.name = "trail";
  host.root.add(trailGroup);

  // length annotation
  const Llab = new THREE.Object3D();
  Llab.position.set(
    PIVOT.x + (L / 2) * Math.sin(theta0) + 0.1,
    PIVOT.y - (L / 2) * Math.cos(theta0),
    0
  );
  Llab.userData.annotation = `$L = ${L.toFixed(2)}\\,\\mathrm{m}$`;
  Llab.name = "L-label";
  host.root.add(Llab);

  // scale scene slightly so L~0.8 fits nicely — already positioned with PIVOT
  // frame: ground hint
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.02),
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
  );
  ground.position.set(0, bottomPos.y - 0.18, -0.02);
  host.root.add(ground);

  // initial camera framing hint via agent camera (stripped after setup — first mount only)
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(0, 0.05, 5);
  cam.lookAt(0, 0.05, 0);
  host.root.add(cam);
}

export function update(host, t, dt) {
  const sim = host.root.userData.sim;
  if (!sim) return;

  const { L, m, g, theta0 } = sim;
  // integrate θ'' = −(g/L) sin θ  (no damping)
  // semi-implicit Euler is stable enough for this
  let { theta, omega } = sim;
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const alpha = -(g / L) * Math.sin(theta);
    omega += alpha * h;
    theta += omega * h;
  }
  // soft clamp energy drift: if past release amplitude, reflect lightly
  if (Math.abs(theta) > theta0 + 0.02 && Math.sign(theta) === Math.sign(omega)) {
    // project back onto energy shell
    const c = Math.min(1, Math.max(-1, (Math.cos(theta0) + (omega * omega * L) / (2 * g))));
    // leave numerical; only flip if wildly overshoot
    if (Math.abs(theta) > theta0 * 1.15) {
      omega = -omega * 0.999;
      theta = Math.sign(theta) * theta0;
    }
  }
  sim.theta = theta;
  sim.omega = omega;

  const pos = bobPos(theta, L);
  const bob = host.root.getObjectByName("bob");
  const string = host.root.getObjectByName("string");
  if (bob) bob.position.copy(pos);
  if (string) {
    const arr = string.geometry.attributes.position.array;
    arr[0] = PIVOT.x; arr[1] = PIVOT.y; arr[2] = PIVOT.z;
    arr[3] = pos.x; arr[4] = pos.y; arr[5] = pos.z;
    string.geometry.attributes.position.needsUpdate = true;
  }

  // speed and tension at current angle
  // energy: ½ m (Lω)² + mg L (1−cosθ) = mg L (1−cosθ₀)
  const v = Math.abs(L * omega);
  const T = m * g * Math.cos(theta) + m * L * omega * omega;

  const liveV = host.root.getObjectByName("live-v");
  if (liveV) {
    liveV.userData.annotation = `$|\\vec v| = ${v.toFixed(3)}\\,\\mathrm{m/s}$`;
  }
  const liveTh = host.root.getObjectByName("live-theta");
  if (liveTh) {
    liveTh.userData.annotation = `$\\theta = ${(theta / DEG).toFixed(1)}^\\circ$`;
  }
  const liveT = host.root.getObjectByName("live-T");
  if (liveT) {
    liveT.userData.annotation = `$T(\\theta) = ${T.toFixed(3)}\\,\\mathrm{N}$`;
  }

  // highlight bottom ring when near bottom
  const ring = host.root.getObjectByName("bottom-ring");
  if (ring) {
    const near = Math.abs(theta) < 0.08;
    ring.material.color.setHex(near ? 0xfacc15 : 0x22c55e);
    ring.scale.setScalar(near ? 1.25 : 1);
  }

  // trail
  if (sim.showTrail) {
    const trailGroup = host.root.getObjectByName("trail");
    if (trailGroup) {
      sim.trail.push(pos.clone());
      if (sim.trail.length > sim.maxTrail) sim.trail.shift();
      while (trailGroup.children.length) {
        const c = trailGroup.children.pop();
        c.geometry?.dispose?.();
        c.material?.dispose?.();
      }
      if (sim.trail.length > 1) {
        const geo = new THREE.BufferGeometry().setFromPoints(sim.trail);
        const line = new THREE.Line(
          geo,
          new THREE.LineBasicMaterial({ color: 0xfdba74, transparent: true, opacity: 0.7 })
        );
        trailGroup.add(line);
      }
    }
  }
}

export function params() {
  return [
    {
      type: "card",
      title: "Pendulum",
      children: [
        {
          type: "note",
          text: "Released from rest at θ₀. Play to swing. At the bottom, energy fixes v; radial force balance fixes T.",
        },
        { key: "L", type: "number", label: "Length L", min: 0.3, max: 1.5, step: 0.05, default: 0.8, unit: "m" },
        { key: "m", type: "number", label: "Mass m", min: 0.05, max: 2, step: 0.05, default: 0.25, unit: "kg" },
        { key: "theta0", type: "number", label: "Release angle θ₀", min: 5, max: 80, step: 1, default: 30, unit: "°" },
        { key: "g", type: "number", label: "Gravity g", min: 1, max: 20, step: 0.1, default: 9.8, unit: "m/s²" },
        {
          type: "label",
          label: "Height drop h",
          value: (q) => {
            const h = heightDrop(q.L ?? 0.8, (q.theta0 ?? 30) * DEG);
            return `${h.toFixed(4)} m`;
          },
        },
        {
          type: "label",
          label: "v at bottom",
          value: (q) => {
            const v = speedAtBottom(q.L ?? 0.8, (q.theta0 ?? 30) * DEG, q.g ?? 9.8);
            return `${v.toFixed(4)} m/s`;
          },
        },
        {
          type: "label",
          label: "T at bottom",
          value: (q) => {
            const T = tensionAtBottom(q.m ?? 0.25, q.L ?? 0.8, (q.theta0 ?? 30) * DEG, q.g ?? 9.8);
            return `${T.toFixed(4)} N`;
          },
        },
      ],
    },
    {
      type: "card",
      title: "Display",
      children: [
        { key: "show_height", type: "boolean", label: "Show height h", default: true },
        { key: "show_energy", type: "boolean", label: "Show energy solution", default: true },
        { key: "show_forces", type: "boolean", label: "Forces at bottom", default: true },
        { key: "show_trail", type: "boolean", label: "Motion trail", default: true },
        {
          type: "label",
          label: "Period (approx)",
          value: (q) => {
            const T = periodApprox(q.L ?? 0.8, q.g ?? 9.8, (q.theta0 ?? 30) * DEG);
            return `${T.toFixed(3)} s`;
          },
        },
      ],
    },
    {
      type: "card",
      title: "How to solve",
      children: [
        {
          type: "note",
          text: "1) Height lost: h = L(1 − cos θ₀). PE → KE: mgh = ½mv² ⇒ v = √(2gh).",
        },
        {
          type: "note",
          text: "2) At bottom, net radial force is centripetal: T − mg = mv²/L ⇒ T = m(g + v²/L).",
        },
        {
          type: "note",
          text: "With defaults: h ≈ 0.1072 m, v ≈ 1.450 m/s, T ≈ 3.107 N.",
        },
      ],
    },
  ];
}

export function validateParams(params) {
  const issues = [];
  if ((params.L ?? 0) <= 0) issues.push({ key: "L", message: "L must be positive" });
  if ((params.m ?? 0) <= 0) issues.push({ key: "m", message: "m must be positive" });
  if ((params.g ?? 0) <= 0) issues.push({ key: "g", message: "g must be positive" });
  return issues;
}
