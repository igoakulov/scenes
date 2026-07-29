import * as THREE from "three";

export function rootHasAgentLight(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((o) => {
    if (found) return;
    if (o instanceof THREE.Light) found = true;
  });
  return found;
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
  // Collect outside the callback — TS does not treat traverse assignments as narrowing.
  const cameras: THREE.Camera[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Camera) cameras.push(o);
  });
  const agent = cameras[0];
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

/** Strip all cameras under root; return pose of the first (if any). */
export function stripAgentCameras(root: THREE.Object3D): StartView | null {
  let first: StartView | null = null;
  for (;;) {
    const view = takeAgentStartCamera(root);
    if (!view) break;
    if (!first) first = view;
  }
  return first;
}
