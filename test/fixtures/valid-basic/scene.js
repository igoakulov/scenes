import * as THREE from "three";

export function setup(ctx) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x4488ff }),
  );
  mesh.name = "box";
  ctx.root.add(mesh);

  const label = new THREE.Object3D();
  label.position.set(0, 0.75, 0);
  label.userData.annotation = "Box · $1^3$";
  label.name = "box-label";
  ctx.root.add(label);
}

export function params() {
  return [
    {
      type: "card",
      title: "Box",
      children: [
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
        { type: "label", label: "Hint", value: "Unit cube" },
        { type: "note", text: "Simple demo mesh." },
      ],
    },
  ];
}
