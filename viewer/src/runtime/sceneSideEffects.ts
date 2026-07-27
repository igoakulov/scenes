/**
 * Scene-lifetime DOM listener tracking (contract §9).
 * While active, wraps addEventListener/removeEventListener on canvas, window, document.
 * On stop: removes every tracked listener and restores originals.
 */

type ListenerOptions = boolean | AddEventListenerOptions | undefined;

type Tracked = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options: ListenerOptions;
};

type PatchedTarget = {
  target: EventTarget;
  add: typeof EventTarget.prototype.addEventListener;
  remove: typeof EventTarget.prototype.removeEventListener;
};

function optionsCapture(options: ListenerOptions): boolean {
  if (typeof options === "boolean") return options;
  if (options && typeof options === "object") return Boolean(options.capture);
  return false;
}

/** Same capture flag is required for removeEventListener to match. */
function removalOptions(options: ListenerOptions): boolean | EventListenerOptions {
  if (typeof options === "boolean") return options;
  if (options && typeof options === "object") {
    return { capture: Boolean(options.capture) };
  }
  return false;
}

export class SceneSideEffects {
  private tracked: Tracked[] = [];
  private patched: PatchedTarget[] = [];
  private active = false;

  get isActive(): boolean {
    return this.active;
  }

  /**
   * Begin tracking on the host canvas, window, and document.
   * No-op if already active (call stop first).
   */
  start(canvas: EventTarget): void {
    if (this.active) return;
    this.active = true;
    this.tracked = [];
    this.patched = [];

    const targets: EventTarget[] = [canvas, window, document];
    for (const target of targets) {
      this.patchTarget(target);
    }
  }

  /** Remove all tracked listeners and unpatch. Safe if never started. */
  stop(): void {
    if (!this.active && this.patched.length === 0 && this.tracked.length === 0) {
      return;
    }

    // Unpatch first so removals use native removeEventListener.
    const toRemove = this.tracked;
    this.tracked = [];
    for (const p of this.patched) {
      p.target.addEventListener = p.add;
      p.target.removeEventListener = p.remove;
    }
    this.patched = [];
    this.active = false;

    for (const entry of toRemove) {
      try {
        entry.target.removeEventListener(
          entry.type,
          entry.listener,
          removalOptions(entry.options),
        );
      } catch {
        // Best-effort; target may already be gone.
      }
    }
  }

  private patchTarget(target: EventTarget): void {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);

    this.patched.push({ target, add, remove });

    target.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (listener != null) {
        this.tracked.push({ target, type, listener, options });
      }
      return add(type, listener as EventListenerOrEventListenerObject, options);
    };

    target.removeEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (listener != null) {
        const cap = optionsCapture(options);
        this.tracked = this.tracked.filter(
          (t) =>
            !(
              t.target === target &&
              t.type === type &&
              t.listener === listener &&
              optionsCapture(t.options) === cap
            ),
        );
      }
      return remove(
        type,
        listener as EventListenerOrEventListenerObject,
        options,
      );
    };
  }
}
