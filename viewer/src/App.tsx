import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  PanelRightIcon,
  PanelRightCloseIcon,
} from "lucide-react";
import { SummaryPanel } from "./chrome/SummaryPanel";
import { ExploreTools } from "./chrome/ExploreTools";
import { LibraryPanel } from "./chrome/LibraryPanel";
import { Button } from "@/components/ui/button";
import { loadScene, type LoadedScene } from "./runtime/loadScene";
import {
  DEFAULT_GRID,
  SceneRuntime,
  type GridState,
} from "./runtime/SceneRuntime";
import { cn } from "@/lib/utils";

type DrawerMode = "library" | "scene";
type SceneTab = "summary" | "explore";

function readIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id || !id.trim()) return null;
  return id.trim();
}

/** Session-only Grid prefs keyed by scene id (and library shell). */
const gridByKey = new Map<string, GridState>();
const LIBRARY_KEY = "__library__";

function gridKey(sceneId: string | null): string {
  return sceneId ?? LIBRARY_KEY;
}

export function App() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);

  const [sheetOpen, setSheetOpen] = useState(true);
  const [mode, setMode] = useState<DrawerMode>(() =>
    readIdFromUrl() ? "scene" : "library",
  );
  const [sceneId, setSceneId] = useState<string | null>(() => readIdFromUrl());
  const [sceneTab, setSceneTab] = useState<SceneTab>("summary");
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridState>(() => {
    const id = readIdFromUrl();
    return gridByKey.get(gridKey(id)) ?? { ...DEFAULT_GRID };
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const rt = new SceneRuntime({ container: host });
    runtimeRef.current = rt;
    const initial = gridByKey.get(gridKey(readIdFromUrl())) ?? {
      ...DEFAULT_GRID,
    };
    rt.setGridState(initial);
    return () => {
      rt.dispose();
      runtimeRef.current = null;
    };
  }, []);

  // Simple global keys: / panel, r reset (no fancy shortcut UI)
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
        e.preventDefault();
        runtimeRef.current?.resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    if (!sceneId || mode === "library") {
      rt.showEmpty();
      setLoaded(null);
      setError(null);
      document.title = "Scenes";
      const saved = gridByKey.get(LIBRARY_KEY) ?? { ...DEFAULT_GRID };
      setGrid(saved);
      rt.setGridState(saved);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSceneTab("summary");

    const saved = gridByKey.get(sceneId) ?? { ...DEFAULT_GRID };
    setGrid(saved);
    rt.setGridState(saved);

    void (async () => {
      try {
        const scene = await loadScene(sceneId);
        if (cancelled) return;
        rt.mountScene(scene);
        setLoaded(scene);
        document.title = `${scene.metadata.title} · Scenes`;
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setLoaded(null);
        rt.showEmpty();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sceneId, mode]);

  const onGridChange = useCallback(
    (partial: Partial<GridState>) => {
      setGrid((prev) => {
        const next: GridState = {
          ...prev,
          ...partial,
          step: Math.max(0.01, partial.step ?? prev.step),
          size: Math.max(0.01, partial.size ?? prev.size),
          showFloor: partial.showFloor ?? prev.showFloor,
          showXY: partial.showXY ?? prev.showXY,
          showYZ: partial.showYZ ?? prev.showYZ,
        };
        runtimeRef.current?.setGridState(next);
        gridByKey.set(gridKey(mode === "library" ? null : sceneId), next);
        return next;
      });
    },
    [sceneId, mode],
  );

  const goLibrary = () => {
    setMode("library");
    setSceneId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.pathname + url.search);
    document.title = "Scenes";
  };

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

  const isLibrary = mode === "library" || !sceneId;

  return (
    <div className="app-shell">
      {/* Single stable control — never remounts between open/closed (avoids flash). */}
      <div className="panel-toggle-float">{panelBtn}</div>

      <div className="viewport">
        <div className="wordmark">Scenes</div>
        <div className="viewport-canvas-host" ref={canvasHostRef} />
        {error && <div className="viewport-error">{error}</div>}
      </div>

      <aside
        className={cn("sheet", sheetOpen ? "sheet-open" : "sheet-closed")}
        aria-hidden={!sheetOpen}
      >
        <div className="sheet-inner">
          {isLibrary ? (
            <>
              <header className="sheet-header">
                <span className="sheet-title">Library</span>
              </header>
              <div className="sheet-body">
                <LibraryPanel />
              </div>
            </>
          ) : (
            <>
              <header className="sheet-header">
                <button
                  type="button"
                  className="sheet-back"
                  title="Back to library"
                  aria-label="Back to library"
                  onClick={goLibrary}
                >
                  <ChevronLeftIcon className="size-4" />
                </button>
                <div className="sheet-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sceneTab === "summary"}
                    className={cn(
                      "sheet-tab",
                      sceneTab === "summary" && "sheet-tab-active",
                    )}
                    onClick={() => setSceneTab("summary")}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sceneTab === "explore"}
                    className={cn(
                      "sheet-tab",
                      sceneTab === "explore" && "sheet-tab-active",
                    )}
                    onClick={() => setSceneTab("explore")}
                  >
                    Explore
                  </button>
                </div>
              </header>
              <div className="sheet-body">
                {sceneTab === "summary" && loaded && (
                  <SummaryPanel metadata={loaded.metadata} />
                )}
                {sceneTab === "summary" && !loaded && loading && (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                )}
                {sceneTab === "explore" && (
                  <ExploreTools
                    grid={grid}
                    onGridChange={onGridChange}
                    onResetView={() => runtimeRef.current?.resetView()}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
