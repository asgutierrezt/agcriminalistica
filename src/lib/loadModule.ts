/**
 * Loads a lazily-imported module (the 3D scenes). If the import fails, the
 * page was most likely cached before a new version was published, so the
 * file names it points to no longer exist: reload once to get the current
 * page. A flag in sessionStorage prevents reload loops.
 */
const KEY = 'ag-stale-reload';

export async function loadModule<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    const mod = await loader();
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    return mod;
  } catch {
    try {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        location.reload();
      }
    } catch {}
    return null;
  }
}

/** True right after such a reload: the visitor already interacted, so start the 3D straight away. */
export function reloadedForUpdate(): boolean {
  try {
    return !!sessionStorage.getItem(KEY);
  } catch {
    return false;
  }
}

const ENGAGE = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'mousemove', 'scroll'];

/**
 * Calls `start` on the visitor's first interaction (touch, mouse, wheel, keyboard or
 * scroll) or, when there is none, a few seconds after the page has loaded, so someone
 * who just watches also sees the 3D come alive (not with "data saver" on). Right after
 * a reload for an update it starts at once.
 */
export function startWhenEngaged(start: () => void, idleMs = 5000) {
  let done = false;
  let timer = 0;
  const go = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    ENGAGE.forEach((ev) => removeEventListener(ev, go));
    start();
  };
  ENGAGE.forEach((ev) => addEventListener(ev, go, { once: true, passive: true }));
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  const arm = () => {
    if (!saveData) timer = window.setTimeout(go, idleMs);
  };
  if (document.readyState === 'complete') arm();
  else addEventListener('load', arm, { once: true });
  if (reloadedForUpdate()) go();
}
