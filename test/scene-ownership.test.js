import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
  rootHasAgentLight,
  stripOriginReferenceHelpers,
  takeAgentStartCamera,
} from "../viewer/src/runtime/sceneOwnership.ts";

/**
 * One case: light detect, origin XY/XZ/YZ strip vs keep diagonal/off-origin,
 * start Camera pose + remove (FOV not used by helper — only pos/look).
 */
describe("scene ownership", () => {
  it("lights / origin grid strip / start camera", () => {
    const root = new THREE.Group();

    assert.equal(rootHasAgentLight(root), false);
    root.add(new THREE.AmbientLight(0xffffff, 0.5));
    assert.equal(rootHasAgentLight(root), true);

    const floor = new THREE.GridHelper(10, 10); // XZ at origin → strip
    const xy = new THREE.GridHelper(10, 10);
    xy.rotation.x = Math.PI / 2;
    const axes = new THREE.AxesHelper(2);
    const offOrigin = new THREE.GridHelper(4, 4);
    offOrigin.position.set(5, 0, 0);
    const diagonal = new THREE.GridHelper(4, 4);
    diagonal.rotation.y = Math.PI / 4; // through origin, not axis-aligned → keep
    root.add(floor, xy, axes, offOrigin, diagonal);

    stripOriginReferenceHelpers(root);
    assert.equal(floor.parent, null);
    assert.equal(xy.parent, null);
    assert.equal(axes.parent, null);
    assert.equal(offOrigin.parent, root);
    assert.equal(diagonal.parent, root);

    const cam = new THREE.PerspectiveCamera(12, 2, 0.01, 9); // odd FOV — ignored by adopt
    cam.position.set(4, 2, 6);
    cam.lookAt(0, 0, 0);
    root.add(cam);
    const view = takeAgentStartCamera(root);
    assert.ok(view);
    assert.ok(view.position.distanceTo(new THREE.Vector3(4, 2, 6)) < 1e-5);
    assert.equal(cam.parent, null);
    // look roughly toward origin from (4,2,6)
    const toOrigin = new THREE.Vector3(0, 0, 0).sub(view.position).normalize();
    const look = view.target.clone().sub(view.position).normalize();
    assert.ok(look.dot(toOrigin) > 0.99);
  });
});
