import * as THREE from "three";

export const runtime = { lights: true, helpers: true, camera: true, playback: true };

const COLORS = {
  basisX: 0xef4444,
  basisY: 0x22c55e,
  basisZ: 0x3b82f6,
  u: 0xf97316,
  v: 0xa855f7,
  sum: 0x0ea5e9,
  scaled: 0xeab308,
  ghost: 0x94a3b8,
};

function addArrow(root, origin, dir, length, color, headLength, headWidth) {
  if (length < 1e-6) return null;
  const d = dir.clone();
  if (d.lengthSq() < 1e-12) return null;
  d.normalize();
  const arrow = new THREE.ArrowHelper(
    d,
    origin,
    length,
    color,
    headLength ?? Math.min(0.28, length * 0.22),
    headWidth ?? Math.min(0.16, length * 0.12)
  );
  root.add(arrow);
  return arrow;
}

function addAnnotation(root, position, text) {
  const a = new THREE.Object3D();
  a.position.copy(position);
  a.userData.annotation = text;
  root.add(a);
  return a;
}

function addDashedSegment(root, a, b, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.12,
    gapSize: 0.08,
    transparent: true,
    opacity: 0.85,
  });
  const line = new THREE.Line(geo, mat);
  line.computeLineDistances();
  root.add(line);
  return line;
}

export function setup(host) {
  const p = host.params;
  const show = Array.isArray(p.show) ? p.show : [];

  const ux = p.u_x ?? 2;
  const uy = p.u_y ?? 1;
  const uz = p.u_z ?? 0.5;
  const vx = p.v_x ?? 0.5;
  const vy = p.v_y ?? 1.5;
  const vz = p.v_z ?? 0.8;
  const s = p.scalar ?? 1.5;

  const O = new THREE.Vector3(0, 0, 0);
  const U = new THREE.Vector3(ux, uy, uz);
  const V = new THREE.Vector3(vx, vy, vz);
  const S = U.clone().add(V);
  const SU = U.clone().multiplyScalar(s);

  // Starting camera pose (first mount only; host strips after setup)
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(5.2, 3.6, 6.4);
  cam.lookAt(0.4, 0.6, 0.3);
  host.root.add(cam);

  // --- Standard basis ---
  if (show.includes("basis")) {
    const bl = p.basis_len ?? 1;
    addArrow(host.root, O, new THREE.Vector3(1, 0, 0), bl, COLORS.basisX, 0.22, 0.12);
    addArrow(host.root, O, new THREE.Vector3(0, 1, 0), bl, COLORS.basisY, 0.22, 0.12);
    addArrow(host.root, O, new THREE.Vector3(0, 0, 1), bl, COLORS.basisZ, 0.22, 0.12);
    if (p.show_labels !== false) {
      addAnnotation(host.root, new THREE.Vector3(bl + 0.15, 0, 0), "$\\mathbf{e}_1$");
      addAnnotation(host.root, new THREE.Vector3(0, bl + 0.15, 0), "$\\mathbf{e}_2$");
      addAnnotation(host.root, new THREE.Vector3(0, 0, bl + 0.15), "$\\mathbf{e}_3$");
    }
  }

  // --- Vector u ---
  if (show.includes("u")) {
    const len = U.length();
    addArrow(host.root, O, U, len, COLORS.u);
    if (p.show_labels !== false && len > 1e-6) {
      const tip = U.clone().multiplyScalar(1 + 0.12 / len);
      addAnnotation(host.root, tip, "$\\mathbf{u}$");
    }
  }

  // --- Vector v ---
  if (show.includes("v")) {
    const len = V.length();
    addArrow(host.root, O, V, len, COLORS.v);
    if (p.show_labels !== false && len > 1e-6) {
      const tip = V.clone().multiplyScalar(1 + 0.12 / len);
      addAnnotation(host.root, tip, "$\\mathbf{v}$");
    }
  }

  // --- Parallelogram (ghost edges for tip-to-tail story) ---
  if (show.includes("parallelogram")) {
    // From tip of u draw v; from tip of v draw u
    addDashedSegment(host.root, U, S, COLORS.ghost);
    addDashedSegment(host.root, V, S, COLORS.ghost);
    // Optional thin solid copies of u,v for the other two sides if not already shown
    if (!show.includes("u") && U.length() > 1e-6) {
      addDashedSegment(host.root, O, U, COLORS.u);
    }
    if (!show.includes("v") && V.length() > 1e-6) {
      addDashedSegment(host.root, O, V, COLORS.v);
    }
  }

  // --- Sum u + v ---
  if (show.includes("sum")) {
    const len = S.length();
    addArrow(host.root, O, S, len, COLORS.sum);
    if (p.show_labels !== false && len > 1e-6) {
      const tip = S.clone().multiplyScalar(1 + 0.14 / len);
      addAnnotation(host.root, tip, "$\\mathbf{u}+\\mathbf{v}$");
    }
  }

  // --- Scalar stretch s u ---
  if (show.includes("scaled")) {
    const len = SU.length();
    if (len > 1e-6) {
      addArrow(host.root, O, SU, len, COLORS.scaled);
      if (p.show_labels !== false) {
        const tip = SU.clone().multiplyScalar(1 + 0.14 / len);
        const label =
          Math.abs(s - 1) < 1e-9
            ? "$1\\,\\mathbf{u}$"
            : `$s\\,\\mathbf{u}$`;
        addAnnotation(host.root, tip, label);
      }
    } else if (p.show_labels !== false) {
      addAnnotation(host.root, new THREE.Vector3(0.2, 0.2, 0), "$s\\,\\mathbf{u}=\\mathbf{0}$");
    }
    // Faint original u when stretching so students see the scale change
    if (!show.includes("u") && U.length() > 1e-6) {
      addDashedSegment(host.root, O, U, COLORS.u);
    }
  }
}

export function params() {
  return [
    {
      type: "card",
      title: "Layers",
      children: [
        {
          type: "note",
          text: "Orange $\\mathbf{u}$, purple $\\mathbf{v}$, cyan sum, yellow $s\\mathbf{u}$. RGB = standard basis $\\mathbf{e}_1,\\mathbf{e}_2,\\mathbf{e}_3$. Toggle layers as you talk.",
        },
        {
          key: "show",
          type: "multiselect",
          label: "Show",
          options: ["basis", "u", "v", "parallelogram", "sum", "scaled"],
          default: ["basis", "u", "v", "parallelogram", "sum"],
        },
        { key: "show_labels", type: "boolean", label: "Annotations", default: true },
        {
          key: "basis_len",
          type: "number",
          label: "Basis length",
          min: 0.5,
          max: 2,
          step: 0.1,
          default: 1,
          unit: "u",
        },
        {
          type: "label",
          label: "$|\\mathbf{u}|$",
          value: (q) => Math.hypot(q.u_x ?? 0, q.u_y ?? 0, q.u_z ?? 0).toFixed(2),
        },
        {
          type: "label",
          label: "$|\\mathbf{v}|$",
          value: (q) => Math.hypot(q.v_x ?? 0, q.v_y ?? 0, q.v_z ?? 0).toFixed(2),
        },
        {
          type: "label",
          label: "$|\\mathbf{u}+\\mathbf{v}|$",
          value: (q) =>
            Math.hypot(
              (q.u_x ?? 0) + (q.v_x ?? 0),
              (q.u_y ?? 0) + (q.v_y ?? 0),
              (q.u_z ?? 0) + (q.v_z ?? 0)
            ).toFixed(2),
        },
        {
          type: "label",
          label: "$|s\\,\\mathbf{u}|$",
          value: (q) =>
            (Math.abs(q.scalar ?? 0) * Math.hypot(q.u_x ?? 0, q.u_y ?? 0, q.u_z ?? 0)).toFixed(2),
        },
      ],
    },
    {
      type: "card",
      title: "Vector $\\mathbf{u}$",
      children: [
        { key: "u_x", type: "number", label: "$u_x$", min: -3, max: 3, step: 0.1, default: 2, unit: "u" },
        { key: "u_y", type: "number", label: "$u_y$", min: -3, max: 3, step: 0.1, default: 1, unit: "u" },
        { key: "u_z", type: "number", label: "$u_z$", min: -3, max: 3, step: 0.1, default: 0.5, unit: "u" },
      ],
    },
    {
      type: "card",
      title: "Vector $\\mathbf{v}$",
      children: [
        { key: "v_x", type: "number", label: "$v_x$", min: -3, max: 3, step: 0.1, default: 0.5, unit: "u" },
        { key: "v_y", type: "number", label: "$v_y$", min: -3, max: 3, step: 0.1, default: 1.5, unit: "u" },
        { key: "v_z", type: "number", label: "$v_z$", min: -3, max: 3, step: 0.1, default: 0.8, unit: "u" },
      ],
    },
    {
      type: "card",
      title: "Scalar stretch",
      children: [
        {
          type: "note",
          text: "Enable **scaled** in Show. Try $s>1$, $0<s<1$, and $s<0$ (reverses).",
        },
        {
          key: "scalar",
          type: "number",
          label: "$s$",
          min: -2.5,
          max: 2.5,
          step: 0.1,
          default: 1.5,
        },
      ],
    },
  ];
}

export function validateParams(params) {
  const issues = [];
  const keys = ["u_x", "u_y", "u_z", "v_x", "v_y", "v_z", "scalar", "basis_len"];
  for (const k of keys) {
    const n = params[k];
    if (n !== undefined && !Number.isFinite(Number(n))) {
      issues.push({ key: k, message: "must be a finite number" });
    }
  }
  return issues;
}
