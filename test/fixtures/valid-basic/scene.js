import * as THREE from "three";

export function setup(host) {
  const size = Number(host.params.size) || 1;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      wireframe: host.params.style === "wire",
    }),
  );
  mesh.name = "box";
  mesh.visible = host.params.visible !== false;
  host.root.add(mesh);

  const label = new THREE.Object3D();
  label.position.set(0, size * 0.75, 0);
  label.userData.annotation = "Box · $s$";
  label.name = "box-label";
  host.root.add(label);
}

export function params() {
  return [
    {
      type: "card",
      title: "Box",
      children: [
        { key: "size", type: "number", label: "Size", min: 0.1, max: 5, default: 1, step: 0.1 },
        { key: "visible", type: "boolean", label: "Visible", default: true },
        { key: "style", type: "select", label: "Style", options: ["solid", "wire"], default: "solid" },
        { type: "label", label: "Hint", value: "Unit cube" },
        { type: "note", text: "Simple demo mesh." },
      ],
    },
  ];
}
