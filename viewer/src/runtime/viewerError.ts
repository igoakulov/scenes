/**
 * Viewport banner: human-friendly + agent-actionable when pasted.
 * Shape: what went wrong · what to do (or accurate detail for the agent).
 */

const REFRESH = "Refresh the page or reopen the scene from the Library.";
const SHOW_RUNNING = "Check that `scenie show` is still running, then refresh.";
const VALIDATE_HINT = "Ask your agent to fix it (or run `scenie validate`).";

export function userFacingError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.trim() || "Unknown error";

  // --- HTTP / fetch ---
  if (/metadata\.json.*\bHTTP 404\b/i.test(msg) || /\b404\b.*metadata/i.test(msg)) {
    return `Couldn't find metadata.json for this scene. ${REFRESH}`;
  }
  if (/scene\.js.*\bHTTP 404\b/i.test(msg) || /\b404\b.*scene\.js/i.test(msg)) {
    return `Couldn't find scene.js for this scene. ${REFRESH}`;
  }
  if (/\bHTTP 404\b/i.test(msg)) {
    return `A file for this scene is missing (404). ${REFRESH}`;
  }
  if (/\bHTTP 5\d\d\b/i.test(msg)) {
    return `The local server returned an error. ${SHOW_RUNNING}`;
  }
  if (/\bHTTP \d{3}\b/i.test(msg)) {
    return `Couldn't load scene files from the server. ${REFRESH}`;
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return `Couldn't reach the local server. ${SHOW_RUNNING}`;
  }

  // --- metadata.json ---
  if (/metadata\.json.*missing title|missing title\/description/i.test(msg)) {
    return `metadata.json needs a title and description. ${VALIDATE_HINT}`;
  }
  if (/metadata\.json.*tags/i.test(msg)) {
    return `metadata.json tags must be a list of strings. ${VALIDATE_HINT}`;
  }
  if (/metadata\.json.*invalid json|unexpected token|json\.parse/i.test(msg)) {
    return `metadata.json isn't valid JSON. Fix the file, then refresh. ${VALIDATE_HINT}`;
  }
  if (/metadata\.json/i.test(msg)) {
    return `Couldn't read metadata.json. Check the file, then refresh. ${VALIDATE_HINT}`;
  }

  // --- scene.js module ---
  if (/setup want function|setup.*want function/i.test(msg)) {
    return `scene.js must export a setup() function. ${VALIDATE_HINT}`;
  }
  if (
    /failed to fetch dynamically imported module|error loading dynamically imported module/i.test(
      msg,
    ) ||
    (/scene\.js/i.test(msg) && /import|syntax|unexpected/i.test(msg))
  ) {
    return `Couldn't load scene.js (missing or syntax error). Fix the file, then refresh. ${VALIDATE_HINT}`;
  }

  // --- runtime export ---
  if (/^runtime: want plain object$/i.test(msg)) {
    return `Invalid runtime export — use a plain object or omit it. Allowed keys: lights, helpers, camera, playback (booleans). ${VALIDATE_HINT}`;
  }
  if (/^runtime\.\w+: unknown key$/i.test(msg)) {
    const key = msg.match(/runtime\.(\w+)/)?.[1] ?? "key";
    return `Unknown runtime flag “${key}”. Allowed: lights, helpers, camera, playback. ${VALIDATE_HINT}`;
  }
  if (/^runtime\.\w+: want boolean$/i.test(msg)) {
    const key = msg.match(/runtime\.(\w+)/)?.[1] ?? "flag";
    return `Runtime flag “${key}” must be true or false. ${VALIDATE_HINT}`;
  }
  if (/^runtime[:.]/i.test(msg)) {
    return `Invalid runtime export: ${stripPrefix(msg, /^runtime:\s*/i)}. ${VALIDATE_HINT}`;
  }

  // --- scene callbacks: keep author detail for agent paste ---
  if (/^setup\(\) threw:/i.test(msg)) {
    return `Scene setup() failed: ${stripPrefix(msg, /^setup\(\) threw:\s*/i)}. Fix setup in scene.js, then refresh.`;
  }
  if (/^update\(\) threw:/i.test(msg)) {
    return `Scene update() failed: ${stripPrefix(msg, /^update\(\) threw:\s*/i)}. Fix update in scene.js, then press Play or refresh.`;
  }
  if (/^params\(\) threw:/i.test(msg)) {
    return `Scene params() failed: ${stripPrefix(msg, /^params\(\) threw:\s*/i)}. Fix params() in scene.js, then refresh.`;
  }
  if (/^onParamsChange threw:/i.test(msg)) {
    return `onParamsChange failed: ${stripPrefix(msg, /^onParamsChange threw:\s*/i)}. Fix onParamsChange in scene.js.`;
  }

  // --- library list ---
  if (/^want array$/i.test(msg) || /^HTTP \d+$/i.test(msg)) {
    return `Couldn't load the scene list. ${REFRESH}`;
  }

  // Unmapped: keep accurate raw text for agents; add a soft next step if bare.
  if (msg.length > 220) {
    return `${msg.slice(0, 200).trim()}… ${REFRESH}`;
  }
  if (!/[.!?]$/.test(msg)) {
    return `${msg}. ${REFRESH}`;
  }
  return msg;
}

function stripPrefix(s: string, re: RegExp): string {
  return s.replace(re, "").trim() || s;
}
