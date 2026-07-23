import { spawn } from "node:child_process";

/** Open URL in the default system browser (best-effort). */
export function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Browser open is best-effort; listen URL is still on stdout.
  }
}
