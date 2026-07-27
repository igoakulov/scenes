import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import {
  rootHasAgentLight,
  takeAgentStartCamera,
} from "../viewer/src/runtime/sceneOwnership.ts";

describe("scene ownership", () => {
  it("detects agent lights under root", () => {
    const root = new THREE.Group();
    assert.equal(rootHasAgentLight(root), false);
    root.add(new THREE.AmbientLight(0xffffff, 0.5));
    assert.equal(rootHasAgentLight(root), true);
  });

  it("adopts start camera pose and removes the agent camera", () => {
    const root = new THREE.Group();
    const cam = new THREE.PerspectiveCamera(12, 2, 0.01, 9);
    cam.position.set(4, 2, 6);
    cam.lookAt(0, 0, 0);
    root.add(cam);
    const view = takeAgentStartCamera(root);
    assert.ok(view);
    assert.ok(view.position.distanceTo(new THREE.Vector3(4, 2, 6)) < 1e-5);
    assert.equal(cam.parent, null);
    const toOrigin = new THREE.Vector3(0, 0, 0).sub(view.position).normalize();
    const look = view.target.clone().sub(view.position).normalize();
    assert.ok(look.dot(toOrigin) > 0.99);
  });
});
