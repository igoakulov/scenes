import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  discoverAnnotations,
  disposeAnnotations,
  syncAnnotationTexts,
  type AnnotationHandle,
} from "./annotations";
import {
  DEFAULT_GRID,
  GridController,
  type GridState,
} from "./grid";
import type { ParamValue } from "./defaults";
import {
  sceneBaseUrlAbsolute,
  type LoadedScene,
  type SceneHostContext,
  type SceneMetadata,
} from "./loadScene";
import {
  DEFAULT_RUNTIME_FLAGS,
  type RuntimeFlags,
} from "./runtimeFlags";
import { rootHasAgentLight, stripAgentCameras } from "./sceneOwnership";
import { SceneSideEffects } from "./sceneSideEffects";

/** Match shadcn dark --background (zinc-950). */
const BG = 0x09090b;

const IDLE_ORBIT_SPEED = 1.0;

export interface PlaybackUi {
  /** True when Play/Pause chrome should show (transport eligible). */
  show: boolean;
  playing: boolean;
}

export interface SceneRuntimeOptions {
  container: HTMLElement;
  onError?: (message: string) => void;
}

export class SceneRuntime {
  private container: HTMLElement;
  private onError?: (message: string) => void;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private root: THREE.Group;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private controls: OrbitControls;
  private grid: GridController;
  /** Runtime default lights — disabled when setup adds any Light under root (if lights flag on). */
  private defaultLights: THREE.Light[] = [];
  private raf = 0;
  private disposed = false;
  private annotations: AnnotationHandle[] = [];
  private dimensions: 2 | 3 = 3;
  private defaultCamPos = new THREE.Vector3(6, 4, 8);
  private defaultTarget = new THREE.Vector3(0, 0, 0);
  private ro: ResizeObserver;
  private sideEffects = new SceneSideEffects();
  private flags: RuntimeFlags = { ...DEFAULT_RUNTIME_FLAGS };
  /** Host OrbitControls intended for navigation (enabled + connected). */
  private hostNavActive = true;
  /** Whether host OrbitControls listeners are currently attached. */
  private hostControlsConnected = true;

  private loaded: LoadedScene | null = null;
  private sceneParams: Record<string, ParamValue> = {};
  /** Sim clock (seconds). Advances only while playing with `update`. */
  private t = 0;
  private playing = false;
  private lastFrameMs: number | null = null;
  /** After update() throws, stay paused until user hits Play (no spam). */
  private updateFaulted = false;
  /** After onFrame() throws, skip further onFrame until remount (no spam). */
  private onFrameFaulted = false;
  private playbackListeners = new Set<() => void>();

  constructor(opts: SceneRuntimeOptions) {
    this.container = opts.container;
    this.onError = opts.onError;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(BG, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(6, 10, 8);
    const fill = new THREE.DirectionalLight(0xffffff, 0.28);
    fill.position.set(-6, 4, -8);
    this.defaultLights = [ambient, key, fill];
    for (const light of this.defaultLights) this.scene.add(light);

    this.grid = new GridController();
    this.scene.add(this.grid.group);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.copy(this.defaultCamPos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = IDLE_ORBIT_SPEED;
    this.controls.target.copy(this.defaultTarget);
    // Any host-nav gesture permanently pauses idle orbit until Play.
    this.controls.addEventListener("start", this.onControlsStart);
    this.applyCameraMode(3);

    this.ro = new ResizeObserver(() => this.resizeNow());
    this.ro.observe(this.container);
    this.resizeNow();
    this.loop();
  }

  getRuntimeFlags(): RuntimeFlags {
    return { ...this.flags };
  }

  getGridState(): GridState {
    return this.grid.getState();
  }

  setGridState(partial: Partial<GridState>): void {
    this.grid.setState(partial);
  }

  getPlaybackUi(): PlaybackUi {
    return {
      show: this.isTransportEligible(),
      playing: this.playing,
    };
  }

  subscribePlayback(cb: () => void): () => void {
    this.playbackListeners.add(cb);
    return () => {
      this.playbackListeners.delete(cb);
    };
  }

  setPlaying(playing: boolean): void {
    if (!this.isTransportEligible()) return;
    if (this.playing === playing) return;
    this.playing = playing;
    if (playing) this.updateFaulted = false;
    this.applyAutoRotate();
    this.notifyPlayback();
  }

  togglePlaying(): void {
    if (!this.isTransportEligible()) return;
    this.setPlaying(!this.playing);
  }

  /** Reset host camera pose. Play state unchanged (contract §6.1). */
  resetView(): void {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultTarget);
    if (this.hostNavActive) this.controls.update();
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.zoom = 1;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Clear root + annotations only (listeners handled by sideEffects). */
  private clearRoot(): void {
    disposeAnnotations(this.annotations);
    this.annotations = [];
    while (this.root.children.length) {
      const c = this.root.children[0]!;
      this.root.remove(c);
      disposeTree(c);
    }
  }

  /** Contract §9 tear-down: listeners then root. */
  private tearDownSceneContent(): void {
    this.sideEffects.stop();
    this.clearRoot();
    // Listener GC can strip OrbitControls pointermove/up; reconnect host nav.
    if (this.hostNavActive) this.reassertHostControls();
  }

  private reassertHostControls(): void {
    this.controls.disconnect();
    // Three disconnect() does not clear _pointers / state; stale drag skips move/up rebind.
    const c = this.controls as OrbitControls & {
      _pointers?: unknown[];
      _pointerPositions?: Record<string, unknown>;
      state: number;
    };
    if (Array.isArray(c._pointers)) c._pointers.length = 0;
    if (c._pointerPositions && typeof c._pointerPositions === "object") {
      for (const k of Object.keys(c._pointerPositions)) delete c._pointerPositions[k];
    }
    c.state = -1; // OrbitControls _STATE.NONE
    this.controls.connect();
    this.hostControlsConnected = true;
    this.controls.enabled = true;
    this.controls.update();
  }

  mountScene(loaded: LoadedScene): void {
    this.tearDownSceneContent();
    this.loaded = loaded;
    this.flags = { ...loaded.runtime };
    this.dimensions = loaded.metadata.dimensions;
    this.sceneParams = { ...loaded.params };
    this.t = 0;
    this.updateFaulted = false;
    this.onFrameFaulted = false;
    this.lastFrameMs = null;
    this.applyCameraMode(this.dimensions);
    this.applyHostPolicy();
    this.resetView();
    this.runSetup(loaded, loaded.params, { adoptStartCamera: true });
    // Autoplay content update always; idle orbit only when transport chrome eligible.
    this.playing =
      this.hasUpdate() || this.isIdleOrbitEligible();
    this.kickUpdateOnce();
    this.applyAutoRotate();
    this.notifyPlayback();
  }

  /**
   * Re-run setup after param edits. Keeps camera pose, flags, and play/pause.
   * Resets t when update exists.
   */
  remountWithParams(
    loaded: LoadedScene,
    params: LoadedScene["params"],
  ): void {
    this.tearDownSceneContent();
    this.loaded = loaded;
    this.sceneParams = { ...params };
    // Flags unchanged on remount (static export). Keep playing boolean.
    if (this.hasUpdate()) this.t = 0;
    this.updateFaulted = false;
    this.onFrameFaulted = false;
    this.applyHostPolicy();
    this.runSetup(loaded, params, { adoptStartCamera: false });
    // Keep playing; force on if content update exists (playback:false still runs).
    if (this.hasUpdate()) {
      if (!this.flags.playback) this.playing = true;
    } else if (!this.isIdleOrbitEligible()) {
      this.playing = false;
    }
    this.kickUpdateOnce();
    this.applyAutoRotate();
    this.notifyPlayback();
  }

  private runSetup(
    loaded: LoadedScene,
    params: LoadedScene["params"],
    opts: { adoptStartCamera: boolean },
  ): void {
    this.sideEffects.start(this.renderer.domElement);
    try {
      loaded.module.setup(this.buildHost(params));
    } catch (err) {
      this.sideEffects.stop();
      throw new Error(
        `setup() threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    this.applyDefaultLightsPolicy();
    if (this.flags.camera) {
      const view = stripAgentCameras(this.root);
      if (opts.adoptStartCamera && view) {
        this.defaultCamPos.copy(view.position);
        this.defaultTarget.copy(view.target);
        this.camera.position.copy(view.position);
        this.controls.target.copy(view.target);
        if (this.hostNavActive) this.controls.update();
      }
    }
    this.annotations = discoverAnnotations(this.root);
  }

  private buildHost(
    params: Record<string, ParamValue> = this.sceneParams,
  ): SceneHostContext {
    const id = this.loaded?.id ?? "";
    return {
      root: this.root,
      params: { ...params },
      baseUrl: sceneBaseUrlAbsolute(id),
      camera: this.camera,
      domElement: this.renderer.domElement,
    };
  }

  private hasUpdate(): boolean {
    return typeof this.loaded?.module.update === "function";
  }

  private hasOnFrame(): boolean {
    return typeof this.loaded?.module.onFrame === "function";
  }

  /** Host idle orbit: static 3D + host camera + playback + no content update. */
  private isIdleOrbitEligible(): boolean {
    return (
      !this.hasUpdate() &&
      this.flags.camera &&
      this.flags.playback &&
      this.dimensions === 3 &&
      this.loaded != null
    );
  }

  private isTransportEligible(): boolean {
    if (!this.flags.playback || this.loaded == null) return false;
    return this.hasUpdate() || this.isIdleOrbitEligible();
  }

  private kickUpdateOnce(): void {
    if (!this.hasUpdate() || !this.loaded) return;
    try {
      this.loaded.module.update!(this.buildHost(), this.t, 0);
    } catch (err) {
      this.handleUpdateError(err);
    }
  }

  private handleUpdateError(err: unknown): void {
    this.playing = false;
    this.updateFaulted = true;
    this.applyAutoRotate();
    this.notifyPlayback();
    const msg = `update() threw: ${err instanceof Error ? err.message : String(err)}`;
    this.onError?.(msg);
  }

  private handleOnFrameError(err: unknown): void {
    this.onFrameFaulted = true;
    const msg = `onFrame() threw: ${err instanceof Error ? err.message : String(err)}`;
    this.onError?.(msg);
  }

  private applyAutoRotate(): void {
    const on = this.isIdleOrbitEligible() && this.playing;
    this.controls.autoRotate = on;
  }

  private onControlsStart = (): void => {
    // Only permanent-pause when idle orbit is the motion source (not content update).
    if (!this.isIdleOrbitEligible()) return;
    if (this.playing) this.setPlaying(false);
  };

  private notifyPlayback(): void {
    for (const cb of this.playbackListeners) cb();
  }

  private applyHostPolicy(): void {
    this.setHostNavActive(this.flags.camera);
    this.grid.group.visible = this.flags.helpers;
  }

  private setHostNavActive(active: boolean): void {
    this.hostNavActive = active;
    if (active) {
      if (!this.hostControlsConnected) {
        this.controls.connect();
        this.hostControlsConnected = true;
      }
      this.controls.enabled = true;
    } else {
      this.controls.enabled = false;
      if (this.hostControlsConnected) {
        this.controls.disconnect();
        this.hostControlsConnected = false;
      }
      this.controls.autoRotate = false;
    }
  }

  private applyDefaultLightsPolicy(): void {
    if (!this.flags.lights) {
      for (const light of this.defaultLights) light.visible = false;
      return;
    }
    const agentLit = rootHasAgentLight(this.root);
    for (const light of this.defaultLights) {
      light.visible = !agentLit;
    }
  }

  /** No scene content — Grid + default lights remain (runtime-owned). */
  showEmpty(): void {
    this.tearDownSceneContent();
    this.loaded = null;
    this.sceneParams = {};
    this.flags = { ...DEFAULT_RUNTIME_FLAGS };
    this.t = 0;
    this.playing = false;
    this.updateFaulted = false;
    this.lastFrameMs = null;
    this.controls.autoRotate = false;
    for (const light of this.defaultLights) light.visible = true;
    this.grid.group.visible = true;
    this.setHostNavActive(true);
    this.applyCameraMode(3);
    this.resetView();
    this.notifyPlayback();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.removeEventListener("start", this.onControlsStart);
    this.tearDownSceneContent();
    this.playbackListeners.clear();
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
    if (this.hostNavActive) this.controls.update();
  }

  private aspect(): number {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    return w / h;
  }

  private resizeNow(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);

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

    if (this.hostNavActive) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private loop = (now: number = performance.now()): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    let dt = 0;
    if (this.lastFrameMs != null) {
      dt = Math.min(0.1, (now - this.lastFrameMs) / 1000);
    }
    this.lastFrameMs = now;

    // Content update: when playback false, always run (no chrome to pause).
    // When playback true, honor playing. Idle orbit uses playing + autoRotate only.
    if (
      this.hasUpdate() &&
      this.loaded &&
      !this.updateFaulted &&
      (this.playing || !this.flags.playback)
    ) {
      this.t += dt;
      try {
        this.loaded.module.update!(this.buildHost(), this.t, dt);
      } catch (err) {
        this.handleUpdateError(err);
      }
    }

    // Wall-clock frame hook (input/camera); runs even while content is paused.
    if (this.hasOnFrame() && this.loaded && !this.onFrameFaulted) {
      try {
        this.loaded.module.onFrame!(this.buildHost(), dt);
      } catch (err) {
        this.handleOnFrameError(err);
      }
    }

    if (this.annotations.length) syncAnnotationTexts(this.annotations);

    // autoRotate needs controls.update(); also damping when host nav on.
    if (this.hostNavActive || this.controls.autoRotate) {
      this.controls.update();
    }
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

export type { SceneMetadata, GridState, RuntimeFlags };
export { DEFAULT_GRID, DEFAULT_RUNTIME_FLAGS };
