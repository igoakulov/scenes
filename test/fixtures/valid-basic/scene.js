import * as THREE from "three";

export function setup(ctx) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x4488ff }),
  );
  mesh.name = "box";
  ctx.root.add(mesh);
}

export function params() {
  return [
    {
      key: "size",
      type: "number",
      label: "Size",
      min: 0.1,
      max: 5,
      default: 1,
      step: 0.1,
    },
    { key: "visible", type: "boolean", label: "Visible", default: true },
    {
      key: "style",
      type: "select",
      label: "Style",
      options: ["solid", "wire"],
      default: "solid",
    },
  ];
}
