import * as THREE from "three";

// TODO: replace with cold-run pendulum scene (examples/prompts/example-pendulum-physics.md)

export const runtime = { lights: true, helpers: true, camera: true, playback: true };

export function setup(host) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf97316 }),
  );
  marker.position.set(0, 0, 0);
  marker.name = "todo-placeholder";
  host.root.add(marker);

  const label = new THREE.Object3D();
  label.position.set(0, 0.35, 0);
  label.userData.annotation = "TODO: pendulum scene";
  label.name = "todo-label";
  host.root.add(label);
}
