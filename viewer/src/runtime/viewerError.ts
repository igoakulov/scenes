/**
 * Turn technical load/runtime failures into short messages for the viewport banner.
 * Prefer calling at display time so raw throws stay greppable in the console if rethrown.
 */

export function userFacingError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.trim() || "Unknown error";

  // --- HTTP / fetch ---
  if (/metadata\.json.*\bHTTP 404\b/i.test(msg) || /\b404\b.*metadata/i.test(msg)) {
    return "Couldn't find this scene's metadata. Refresh the page or reopen it from the library.";
  }
  if (/scene\.js.*\bHTTP 404\b/i.test(msg) || /\b404\b.*scene\.js/i.test(msg)) {
    return "Couldn't find this scene's code (scene.js). Refresh or reopen it from the library.";
  }
  if (/\bHTTP 404\b/i.test(msg)) {
    return "Something for this scene is missing (404). Refresh the page or pick another scene.";
  }
  if (/\bHTTP 5\d\d\b/i.test(msg)) {
    return "The local server had a problem. Check that `scenes show` is still running, then refresh.";
  }
  if (/\bHTTP \d{3}\b/i.test(msg)) {
    return "Couldn't load scene files from the server. Refresh and try again.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Couldn't reach the local server. Is `scenes show` still running?";
  }

  // --- metadata ---
  if (/metadata\.json.*missing title|missing title\/description/i.test(msg)) {
    return "Scene metadata is incomplete — it needs a title and description.";
  }
  if (/metadata\.json.*tags/i.test(msg)) {
    return "Scene metadata is invalid — tags must be a list of strings.";
  }
  if (/metadata\.json.*invalid json|unexpected token|json\.parse/i.test(msg)) {
    return "Scene metadata isn't valid JSON. Fix metadata.json and refresh.";
  }
  if (/metadata\.json/i.test(msg)) {
    return "Couldn't read this scene's metadata. Check metadata.json and refresh.";
  }

  // --- scene module ---
  if (/setup want function|setup.*want function/i.test(msg)) {
    return "This scene is missing a setup() function in scene.js.";
  }
  if (/failed to fetch dynamically imported module|error loading dynamically imported module/i.test(msg)) {
    return "Couldn't load scene.js (missing or has a syntax error). Fix the file and refresh.";
  }
  if (/scene\.js/i.test(msg) && /import|syntax|unexpected/i.test(msg)) {
    return "Couldn't load scene.js. Fix any syntax errors and refresh.";
  }

  // --- runtime export ---
  if (/^runtime: want plain object$/i.test(msg)) {
    return "Invalid runtime export — it must be a plain object (or omitted).";
  }
  if (/^runtime\.\w+: unknown key$/i.test(msg)) {
    const key = msg.match(/runtime\.(\w+)/)?.[1] ?? "key";
    return `Unknown runtime flag “${key}”. Allowed: lights, helpers, camera, playback.`;
  }
  if (/^runtime\.\w+: want boolean$/i.test(msg)) {
    const key = msg.match(/runtime\.(\w+)/)?.[1] ?? "flag";
    return `Runtime flag “${key}” must be true or false.`;
  }
  if (/^runtime[:.]/i.test(msg)) {
    return `Invalid runtime export: ${stripPrefix(msg, /^runtime:\s*/i)}`;
  }

  // --- scene callbacks (keep author detail; soften prefix) ---
  if (/^setup\(\) threw:/i.test(msg)) {
    return `Scene setup failed: ${stripPrefix(msg, /^setup\(\) threw:\s*/i)}`;
  }
  if (/^update\(\) threw:/i.test(msg)) {
    return `Scene update failed: ${stripPrefix(msg, /^update\(\) threw:\s*/i)}`;
  }
  if (/^params\(\) threw:/i.test(msg)) {
    return `Scene params() failed: ${stripPrefix(msg, /^params\(\) threw:\s*/i)}`;
  }
  if (/^onParamsChange threw:/i.test(msg)) {
    return `Parameter change handler failed: ${stripPrefix(msg, /^onParamsChange threw:\s*/i)}`;
  }

  // --- library ---
  if (/^want array$/i.test(msg) || /^HTTP \d+$/i.test(msg)) {
    return "Couldn't load the scene list. Refresh and try again.";
  }

  // Fallback: drop ultra-technical file:line noise if present, keep readable text
  if (msg.length > 220) {
    return `${msg.slice(0, 200).trim()}…`;
  }
  return msg;
}

function stripPrefix(s: string, re: RegExp): string {
  return s.replace(re, "").trim() || s;
}
