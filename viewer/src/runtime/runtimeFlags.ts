/** Re-export shared CLI/viewer runtime flag helpers (single source of truth). */
export {
  DEFAULT_RUNTIME_FLAGS,
  RUNTIME_FLAG_KEYS,
  issuesForRuntimeExport,
  resolveRuntimeFlags,
  type RuntimeFlagIssue,
  type RuntimeFlagKey,
  type RuntimeFlags,
} from "../../../src/runtime-flags";
