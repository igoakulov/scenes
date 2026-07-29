import { useCallback, useEffect, useRef, useState } from "react";
import { PanelRightIcon, PanelRightCloseIcon } from "lucide-react";
import { SummaryPanel } from "./chrome/SummaryPanel";
import { ExploreTools } from "./chrome/ExploreTools";
import { LibraryPanel } from "./chrome/LibraryPanel";
import { ParamsPanel } from "./chrome/params";
import { Button } from "@/components/ui/button";
import { loadScene, type LoadedScene } from "./runtime/loadScene";
import type { ParamValue } from "./runtime/defaults";
import {
  DEFAULT_GRID,
  SceneRuntime,
  type GridState,
} from "./runtime/SceneRuntime";
import { gridForDimensions } from "./runtime/grid";
import { userFacingError } from "./runtime/viewerError";
import { cn } from "@/lib/utils";

type SheetTab = "library" | "summary" | "explore";

function readIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id || !id.trim()) return null;
  return id.trim();
}

/** Session-only Grid prefs keyed by scene id (and no-selection shell). */
const gridByKey = new Map<string, GridState>();
const NO_SCENE_KEY = "__none__";

function gridKey(sceneId: string | null): string {
  return sceneId ?? NO_SCENE_KEY;
}

function paramBagsEqual(
  a: Record<string, ParamValue>,
  b: Record<string, ParamValue>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length || av.some((x, i) => x !== bv[i])) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

export function App() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);

  const [sheetOpen, setSheetOpen] = useState(true);
  const [sceneId, setSceneId] = useState<string | null>(() => readIdFromUrl());
  const [sheetTab, setSheetTab] = useState<SheetTab>(() =>
    readIdFromUrl() ? "summary" : "library",
  );
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [liveParams, setLiveParams] = useState<Record<string, ParamValue>>({});
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridState>(() => {
    const id = readIdFromUrl();
    return gridByKey.get(gridKey(id)) ?? { ...DEFAULT_GRID };
  });
  const [loading, setLoading] = useState(false);
  const [playback, setPlayback] = useState({ show: false, playing: false });

  const hasScene = sceneId != null;

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const rt = new SceneRuntime({
      container: host,
      onError: (message) => setError(userFacingError(message)),
    });
    runtimeRef.current = rt;
    const initial = gridByKey.get(gridKey(readIdFromUrl())) ?? {
      ...DEFAULT_GRID,
    };
    rt.setGridState(initial);
    const unsub = rt.subscribePlayback(() => {
      setPlayback(rt.getPlaybackUi());
    });
    setPlayback(rt.getPlaybackUi());
    return () => {
      unsub();
      rt.dispose();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setSheetOpen((o) => !o);
      } else if (e.key === "r" || e.key === "R") {
        const flags = runtimeRef.current?.getRuntimeFlags();
        if (flags && !flags.camera) return;
        e.preventDefault();
        runtimeRef.current?.resetView();
      } else if (e.key === " " || e.code === "Space") {
        // When camera: false, Space is free for the scene (jump/fly); use Explore Play/Pause.
        const flags = runtimeRef.current?.getRuntimeFlags();
        if (flags && !flags.camera) return;
        const ui = runtimeRef.current?.getPlaybackUi();
        if (!ui?.show) return;
        e.preventDefault();
        runtimeRef.current?.togglePlaying();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load / unload canvas from selection only — sheet tab does not clear selection.
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    if (!sceneId) {
      rt.showEmpty();
      setLoaded(null);
      setLiveParams({});
      setError(null);
      setLoading(false);
      document.title = "Scenes";
      const saved = gridByKey.get(NO_SCENE_KEY) ?? { ...DEFAULT_GRID };
      setGrid(saved);
      rt.setGridState(saved);
      return;
    }

    let cancelled = false;
    // Drop previous scene UI immediately so Summary/Explore never flash old content.
    setLoading(true);
    setError(null);
    setLoaded(null);
    setLiveParams({});
    rt.showEmpty();

    void (async () => {
      try {
        const scene = await loadScene(sceneId);
        if (cancelled) return;
        const dim = scene.metadata.dimensions;
        const saved = gridByKey.get(sceneId) ?? { ...DEFAULT_GRID };
        const next = gridForDimensions(saved, dim);
        gridByKey.set(sceneId, next);
        setGrid(next);
        rt.setGridState(next);
        rt.mountScene(scene);
        setLoaded(scene);
        setLiveParams({ ...scene.params });
        document.title = `${scene.metadata.title} · Scenes`;
      } catch (err) {
        if (cancelled) return;
        setError(userFacingError(err));
        setLoaded(null);
        setLiveParams({});
        rt.showEmpty();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  // If selection is cleared while on a scene tab, land on Library.
  useEffect(() => {
    if (!hasScene && sheetTab !== "library") {
      setSheetTab("library");
    }
  }, [hasScene, sheetTab]);

  const onGridChange = useCallback(
    (partial: Partial<GridState>) => {
      setGrid((prev) => {
        const dim = loaded?.metadata.dimensions ?? 3;
        const merged: GridState = {
          ...prev,
          ...partial,
          step: Math.max(0.01, partial.step ?? prev.step),
          size: Math.max(0.01, partial.size ?? prev.size),
          showFloor: partial.showFloor ?? prev.showFloor,
          showXY: partial.showXY ?? prev.showXY,
          showYZ: partial.showYZ ?? prev.showYZ,
        };
        const next = gridForDimensions(merged, dim);
        runtimeRef.current?.setGridState(next);
        gridByKey.set(gridKey(sceneId), next);
        return next;
      });
    },
    [sceneId, loaded?.metadata.dimensions],
  );

  const openScene = useCallback((id: string) => {
    const next = id.trim();
    if (!next) return;
    setSceneId(next);
    setSheetTab("summary");
    const url = new URL(window.location.href);
    url.searchParams.set("id", next);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  // UI bag updates immediately; scene remount is debounced (typing stays smooth).
  const remountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingParamsRef = useRef<Record<string, ParamValue> | null>(null);

  useEffect(() => {
    return () => {
      if (remountTimerRef.current) clearTimeout(remountTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (remountTimerRef.current) clearTimeout(remountTimerRef.current);
    remountTimerRef.current = null;
    pendingParamsRef.current = null;
  }, [sceneId, loaded?.id]);

  const onParamChange = useCallback(
    (key: string, value: ParamValue) => {
      const rt = runtimeRef.current;
      if (!loaded || !rt) return;

      setLiveParams((prev) => {
        let next: Record<string, ParamValue> = {
          ...prev,
          [key]: Array.isArray(value) ? [...value] : value,
        };
        if (typeof loaded.module.onParamsChange === "function") {
          try {
            next = loaded.module.onParamsChange(next, { key, value });
          } catch (err) {
            setError(
              userFacingError(
                new Error(
                  `onParamsChange threw: ${err instanceof Error ? err.message : String(err)}`,
                ),
              ),
            );
            return prev;
          }
        }

        // Blur after number edit re-commits the same value; remount then kills the first orbit drag.
        if (paramBagsEqual(prev, next)) return prev;

        pendingParamsRef.current = next;
        if (remountTimerRef.current) clearTimeout(remountTimerRef.current);
        remountTimerRef.current = setTimeout(() => {
          remountTimerRef.current = null;
          const bag = pendingParamsRef.current;
          if (!bag || !runtimeRef.current) return;
          try {
            runtimeRef.current.remountWithParams(loaded, bag);
            setError(null);
          } catch (err) {
            setError(userFacingError(err));
          }
        }, 80);

        return next;
      });
    },
    [loaded],
  );

  const onSheetTabChange = useCallback(
    (value: string | number | null) => {
      if (value === "library") {
        setSheetTab("library");
        return;
      }
      if ((value === "summary" || value === "explore") && sceneId) {
        setSheetTab(value);
      }
    },
    [sceneId],
  );

  const toggleSheet = () => setSheetOpen((o) => !o);

  const panelBtn = (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title="Toggle panel [/]"
      aria-label="Toggle panel [/]"
      onClick={toggleSheet}
    >
      {sheetOpen ? (
        <PanelRightCloseIcon className="size-5" data-icon="inline-start" />
      ) : (
        <PanelRightIcon className="size-5" data-icon="inline-start" />
      )}
    </Button>
  );

  return (
    <div className="app-shell">
      {/* Single stable control — never remounts between open/closed (avoids flash). */}
      <div className="panel-toggle-float">{panelBtn}</div>

      <div className="viewport">
        <div className="viewport-canvas-host" ref={canvasHostRef} />
        {error && <div className="viewport-error">{error}</div>}
      </div>

      <aside
        className={cn("sheet", sheetOpen ? "sheet-open" : "sheet-closed")}
        aria-hidden={!sheetOpen}
      >
        <div className="sheet-inner">
          <header className="sheet-header">
            <div
              role="tablist"
              aria-label="Sheet"
              className="inline-flex h-8 min-w-0 items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground"
            >
              {(
                [
                  { id: "library" as const, label: "Library", disabled: false },
                  {
                    id: "summary" as const,
                    label: "Summary",
                    disabled: !hasScene,
                  },
                  {
                    id: "explore" as const,
                    label: "Explore",
                    disabled: !hasScene,
                  },
                ] as const
              ).map((tab) => {
                const active = sheetTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={tab.disabled}
                    className={cn(
                      "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center rounded-md border border-transparent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors outline-none",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      "disabled:pointer-events-none disabled:opacity-50",
                      active
                        ? "bg-background text-foreground dark:border-input dark:bg-input/30"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onSheetTabChange(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>
          <div className="sheet-body">
            <div className="sheet-scroll">
              <div className="min-w-0 px-3 py-3">
                {sheetTab === "library" && (
                  <LibraryPanel onOpen={openScene} />
                )}
                {sheetTab === "summary" &&
                  hasScene &&
                  loaded &&
                  loaded.id === sceneId && (
                    <SummaryPanel id={loaded.id} metadata={loaded.metadata} />
                  )}
                {sheetTab === "summary" &&
                  hasScene &&
                  (!loaded || loaded.id !== sceneId) &&
                  loading && (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  )}
                {sheetTab === "summary" &&
                  hasScene &&
                  !loaded &&
                  !loading &&
                  error && (
                    <p className="sheet-selectable text-xs text-muted-foreground break-words">
                      {error}
                    </p>
                  )}
                {sheetTab === "explore" && hasScene && (
                  <div className="flex min-w-0 flex-col gap-3">
                    {loaded && loaded.id === sceneId ? (
                      <>
                        <ExploreTools
                          grid={grid}
                          dimensions={loaded.metadata.dimensions}
                          showHelpers={loaded.runtime.helpers}
                          showCameraReset={loaded.runtime.camera}
                          showPlayback={playback.show}
                          playing={playback.playing}
                          spaceTogglesPlayback={loaded.runtime.camera}
                          onGridChange={onGridChange}
                          onResetView={() => runtimeRef.current?.resetView()}
                          onTogglePlay={() =>
                            runtimeRef.current?.togglePlaying()
                          }
                        />
                        {loaded.paramsTree.length > 0 && (
                          <ParamsPanel
                            tree={loaded.paramsTree}
                            params={liveParams}
                            onChange={onParamChange}
                          />
                        )}
                      </>
                    ) : loading ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
