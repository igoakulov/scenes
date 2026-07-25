import * as THREE from "three";

const ORIGIN_EPS = 1e-3;
/** World basis nearly axis-aligned (XY / XZ / YZ style). */
const AXIS_DOT = 0.98;
const AXIS_OFF = 0.25;

/** True if object world position is ~ origin. */
export function isNearWorldOrigin(obj: THREE.Object3D): boolean {
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  return p.lengthSq() < ORIGIN_EPS * ORIGIN_EPS;
}

/**
 * True if world rotation is axis-aligned (reference XY / XZ / YZ grids).
 * Diagonal / skewed orientations return false (allowed to keep).
 */
export function isAxisAlignedWorldRotation(obj: THREE.Object3D): boolean {
  obj.updateWorldMatrix(true, false);
  const e = obj.matrixWorld.elements;
  const axes = [
    new THREE.Vector3(e[0], e[1], e[2]),
    new THREE.Vector3(e[4], e[5], e[6]),
    new THREE.Vector3(e[8], e[9], e[10]),
  ];
  for (const a of axes) {
    if (a.lengthSq() < 1e-12) return false;
    a.normalize();
    const c = [Math.abs(a.x), Math.abs(a.y), Math.abs(a.z)].sort(
      (x, y) => y - x,
    );
    if (c[0]! < AXIS_DOT || c[1]! > AXIS_OFF) return false;
  }
  return true;
}

/** Any THREE.Light under root (agent lighting). */
export function rootHasAgentLight(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (found) return;
    if (o instanceof THREE.Light) found = true;
  });
  return found;
}

/**
 * Strip origin-centered reference helpers that recreate runtime Grid:
 * - AxesHelper at origin
 * - GridHelper at origin with axis-aligned (XY/XZ/YZ) orientation
 * Leaves diagonal / off-origin guides.
 */
export function stripOriginReferenceHelpers(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const remove: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o === root) return;
    if (!isNearWorldOrigin(o)) return;
    if (o instanceof THREE.AxesHelper) {
      remove.push(o);
      return;
    }
    if (o instanceof THREE.GridHelper && isAxisAlignedWorldRotation(o)) {
      remove.push(o);
    }
  });
  for (const o of remove) {
    o.parent?.remove(o);
    disposeObjectResources(o);
  }
}

export type StartView = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

/**
 * First Camera under root → initial pose; removes it from the graph.
 * Returns null if none.
 */
export function takeAgentStartCamera(root: THREE.Object3D): StartView | null {
  let agent: THREE.Camera | null = null;
  root.traverse((o) => {
    if (agent) return;
    if (o instanceof THREE.Camera) agent = o;
  });
  if (!agent) return null;

  root.updateWorldMatrix(true, true);
  const position = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  agent.getWorldPosition(position);
  agent.getWorldQuaternion(quat);
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(quat).normalize();
  const target = position.clone().addScaledVector(dir, 8);

  agent.parent?.remove(agent);

  return { position, target };
}

function disposeObjectResources(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (mat) {
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  });
}
