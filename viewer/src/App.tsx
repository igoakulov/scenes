import { useCallback, useEffect, useRef, useState } from "react";
import { PanelRightIcon, PanelRightCloseIcon } from "lucide-react";
import { SummaryPanel } from "./chrome/SummaryPanel";
import { ExploreTools } from "./chrome/ExploreTools";
import { LibraryPanel } from "./chrome/LibraryPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loadScene, type LoadedScene } from "./runtime/loadScene";
import {
  DEFAULT_GRID,
  SceneRuntime,
  type GridState,
} from "./runtime/SceneRuntime";
import { gridForDimensions } from "./runtime/grid";
import { cn } from "@/lib/utils";

/** Sheet body tab — always all three; Summary/Explore need a selected scene. */
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

export function App() {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);

  const [sheetOpen, setSheetOpen] = useState(true);
  const [sceneId, setSceneId] = useState<string | null>(() => readIdFromUrl());
  const [sheetTab, setSheetTab] = useState<SheetTab>(() =>
    readIdFromUrl() ? "summary" : "library",
  );
  const [loaded, setLoaded] = useState<LoadedScene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<GridState>(() => {
    const id = readIdFromUrl();
    return gridByKey.get(gridKey(id)) ?? { ...DEFAULT_GRID };
  });
  const [loading, setLoading] = useState(false);

  const hasScene = sceneId != null;

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

  // Load / unload canvas from selection only — sheet tab does not clear selection.
  useEffect(() => {
    const rt = runtimeRef.current;
    if (!rt) return;

    if (!sceneId) {
      rt.showEmpty();
      setLoaded(null);
      setError(null);
      setLoading(false);
      document.title = "Scenes";
      const saved = gridByKey.get(NO_SCENE_KEY) ?? { ...DEFAULT_GRID };
      setGrid(saved);
      rt.setGridState(saved);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

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
        <div className="wordmark">Scenes</div>
        <div className="viewport-canvas-host" ref={canvasHostRef} />
        {error && <div className="viewport-error">{error}</div>}
      </div>

      <aside
        className={cn("sheet", sheetOpen ? "sheet-open" : "sheet-closed")}
        aria-hidden={!sheetOpen}
      >
        <div className="sheet-inner">
          <header className="sheet-header">
            <Tabs
              value={sheetTab}
              onValueChange={onSheetTabChange}
              className="min-w-0"
            >
              <TabsList>
                <TabsTrigger value="library">Library</TabsTrigger>
                <TabsTrigger value="summary" disabled={!hasScene}>
                  Summary
                </TabsTrigger>
                <TabsTrigger value="explore" disabled={!hasScene}>
                  Explore
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </header>
          <div className="sheet-body">
            {sheetTab === "library" && (
              <LibraryPanel onOpen={openScene} />
            )}
            {sheetTab === "summary" && hasScene && loaded && (
              <SummaryPanel id={loaded.id} metadata={loaded.metadata} />
            )}
            {sheetTab === "summary" && hasScene && !loaded && loading && (
              <p className="text-xs text-muted-foreground">Loading…</p>
            )}
            {sheetTab === "summary" && hasScene && !loaded && !loading && error && (
              <p className="text-xs text-muted-foreground">Could not load scene.</p>
            )}
            {sheetTab === "explore" && hasScene && (
              <ExploreTools
                grid={grid}
                dimensions={loaded?.metadata.dimensions ?? 3}
                onGridChange={onGridChange}
                onResetView={() => runtimeRef.current?.resetView()}
              />
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
