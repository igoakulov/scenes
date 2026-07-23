import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { fillMathElement } from "../math/renderMath";

export interface AnnotationHandle {
  object: THREE.Object3D;
  label: CSS2DObject;
}

/**
 * Discover Object3D with userData.annotation string under root; attach CSS2D chips.
 */
export function discoverAnnotations(root: THREE.Object3D): AnnotationHandle[] {
  const found: AnnotationHandle[] = [];

  root.traverse((obj) => {
    const text = obj.userData?.annotation;
    if (typeof text !== "string" || text.trim() === "") return;

    const el = document.createElement("div");
    el.className = "css2d-label";
    fillMathElement(el, text);
    el.style.pointerEvents = "none";

    const label = new CSS2DObject(el);
    label.position.set(0, 0, 0);
    label.name = "__annotation_chip__";
    // Center on anchor object
    obj.add(label);
    found.push({ object: obj, label });
  });

  return found;
}

export function disposeAnnotations(handles: AnnotationHandle[]): void {
  for (const h of handles) {
    h.object.remove(h.label);
    h.label.element.remove();
  }
}
