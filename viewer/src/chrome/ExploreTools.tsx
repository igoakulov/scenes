import { useEffect, useRef, useState } from "react";
import type { GridState } from "../runtime/grid";
import { DEFAULT_GRID } from "../runtime/grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  grid: GridState;
  /** Scene camera stack — filters which grid planes appear in the menu. */
  dimensions: 2 | 3;
  onGridChange: (partial: Partial<GridState>) => void;
  onResetView: () => void;
}

type PlaneKey = "showFloor" | "showXY" | "showYZ";

const PLANES_3D: { key: PlaneKey; label: string }[] = [
  { key: "showFloor", label: "Floor (XZ)" },
  { key: "showXY", label: "XY" },
  { key: "showYZ", label: "YZ" },
];

/** 2D face-on: single plane, labeled Floor (XY). */
const PLANES_2D: { key: PlaneKey; label: string }[] = [
  { key: "showXY", label: "Floor (XY)" },
];

function planeOptions(dimensions: 2 | 3) {
  return dimensions === 2 ? PLANES_2D : PLANES_3D;
}

/** Compact number field: allow empty while focused; silent snap on blur. */
function DraftNumber({
  id,
  label,
  value,
  defaultValue,
  min,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(n) || n < min) {
      setDraft(String(defaultValue));
      onCommit(defaultValue);
      return;
    }
    const clamped = Math.max(min, n);
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label
        htmlFor={id}
        className="text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        className="h-7 w-full font-mono text-xs tabular-nums"
        value={draft}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          const t = e.target.value;
          setDraft(t);
          const n = Number(t);
          if (t.trim() !== "" && Number.isFinite(n) && n >= min) {
            onCommit(n);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function ExploreTools({
  grid,
  dimensions,
  onGridChange,
  onResetView,
}: Props) {
  const options = planeOptions(dimensions);
  const selectedLabels = options.filter((o) => grid[o.key]).map((o) => o.label);
  const allOn =
    options.length > 0 && options.every((o) => grid[o.key]);
  const summary =
    selectedLabels.length === 0
      ? "None"
      : allOn && options.length > 1
        ? "All planes"
        : selectedLabels.join(", ");

  return (
    <div className="flex flex-col gap-3">
      {/* Grid · Size · Step — plane list filtered by dimensions */}
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,0.55fr)_minmax(0,0.55fr)] items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Grid
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("h-7 w-full min-w-0 justify-between px-2")}
                />
              }
            >
              <span className="min-w-0 truncate" title={summary}>
                {summary}
              </span>
              <ChevronDownIcon data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-44">
              {options.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.key}
                  checked={grid[o.key]}
                  onCheckedChange={(checked) =>
                    onGridChange({ [o.key]: checked === true })
                  }
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <DraftNumber
          id="grid-size"
          label="Size"
          value={grid.size}
          defaultValue={DEFAULT_GRID.size}
          min={0.01}
          onCommit={(size) => onGridChange({ size })}
        />
        <DraftNumber
          id="grid-step"
          label="Step"
          value={grid.step}
          defaultValue={DEFAULT_GRID.step}
          min={0.01}
          onCommit={(step) => onGridChange({ step })}
        />
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={onResetView}>
          Reset view
        </Button>
      </div>
    </div>
  );
}
