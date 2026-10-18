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
