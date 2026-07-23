import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  discoverAnnotations,
  disposeAnnotations,
  type AnnotationHandle,
} from "./annotations";
import {
  DEFAULT_GRID,
  GridController,
  type GridState,
} from "./grid";
import {
  sceneBaseUrlAbsolute,
  type LoadedScene,
  type SceneMetadata,
} from "./loadScene";

/** Match shadcn dark --background (zinc). */
const BG = 0x18181b;

export interface SceneRuntimeOptions {
  container: HTMLElement;
  onError?: (message: string) => void;
}

export class SceneRuntime {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private root: THREE.Group;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls: OrbitControls;
  private grid: GridController;
  private raf = 0;
  private disposed = false;
  private annotations: AnnotationHandle[] = [];
  private dimensions: 2 | 3 = 3;
  private defaultCamPos = new THREE.Vector3(6, 4, 8);
  private defaultTarget = new THREE.Vector3(0, 0, 0);
  private ro: ResizeObserver;

  constructor(opts: SceneRuntimeOptions) {
    this.container = opts.container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(BG, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Fill the host; CSS also forces 100% so buffer and display size stay matched.
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.width = "100%";
    this.labelRenderer.domElement.style.height = "100%";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    this.container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG);

    this.root = new THREE.Group();
    this.root.name = "scene-root";
    this.scene.add(this.root);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(6, 10, 8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.28);
    fill.position.set(-6, 4, -8);
    this.scene.add(fill);

    this.grid = new GridController();
    this.scene.add(this.grid.group);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.copy(this.defaultCamPos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(this.defaultTarget);
    this.applyCameraMode(3);

    this.ro = new ResizeObserver(() => this.resizeNow());
    this.ro.observe(this.container);
    this.resizeNow();
    this.loop();
  }

  getGridState(): GridState {
    return this.grid.getState();
  }

  setGridState(partial: Partial<GridState>): void {
    this.grid.setState(partial);
  }

  resetView(): void {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultTarget);
    this.controls.update();
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
    }
  }

  clearScene(): void {
    disposeAnnotations(this.annotations);
    this.annotations = [];
    while (this.root.children.length) {
      const c = this.root.children[0]!;
      this.root.remove(c);
      disposeTree(c);
    }
  }

  mountScene(loaded: LoadedScene): void {
    this.clearScene();
    this.dimensions = loaded.metadata.dimensions;
    this.applyCameraMode(this.dimensions);
    this.resetView();

    try {
      loaded.module.setup({
        root: this.root,
        params: { ...loaded.params },
        baseUrl: sceneBaseUrlAbsolute(loaded.id),
      });
    } catch (err) {
      throw new Error(
        `setup() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    this.annotations = discoverAnnotations(this.root);
  }

  /** No scene content — Grid remains (runtime-owned). */
  showEmpty(): void {
    this.clearScene();
    this.applyCameraMode(3);
    this.resetView();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.clearScene();
    this.grid.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  private applyCameraMode(dim: 2 | 3): void {
    const aspect = this.aspect();
    const prevPos = this.camera.position.clone();
    const prevTarget = this.controls.target.clone();

    if (dim === 2) {
      const frustum = 8;
      this.camera = new THREE.OrthographicCamera(
        (-frustum * aspect) / 2,
        (frustum * aspect) / 2,
        frustum / 2,
        -frustum / 2,
        0.05,
        500,
      );
      this.defaultCamPos.set(0, 0, 12);
      this.defaultTarget.set(0, 0, 0);
      this.camera.position.copy(this.defaultCamPos);
      this.controls.object = this.camera;
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
    } else {
      this.camera = new THREE.PerspectiveCamera(55, aspect, 0.05, 500);
      this.defaultCamPos.set(6, 4, 8);
      this.defaultTarget.set(0, 0, 0);
      this.camera.position.copy(
        prevPos.lengthSq() > 0.01 ? prevPos : this.defaultCamPos,
      );
      this.controls.object = this.camera;
      this.controls.enableRotate = true;
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = false;
      this.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      this.controls.target.copy(prevTarget);
    }
    this.controls.update();
  }

  private aspect(): number {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    return w / h;
  }

  private resizeNow(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);

    // Update drawing buffer AND element style so WebGL and CSS2D share the
    // same pixel space (false left canvas at default CSS size → offset mesh).
    this.renderer.setSize(w, h, true);
    this.labelRenderer.setSize(w, h);

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    } else {
      const frustum = 8;
      const aspect = w / h;
      this.camera.left = (-frustum * aspect) / 2;
      this.camera.right = (frustum * aspect) / 2;
      this.camera.top = frustum / 2;
      this.camera.bottom = -frustum / 2;
      this.camera.updateProjectionMatrix();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  };
}

function disposeTree(obj: THREE.Object3D): void {
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

export type { SceneMetadata, GridState };
export { DEFAULT_GRID };
