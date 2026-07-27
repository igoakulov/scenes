import * as THREE from "three";

/** Any THREE.Light under root (agent lighting). */
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
