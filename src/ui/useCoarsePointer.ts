import { useSyncExternalStore } from 'react';

const QUERY = '(hover: none)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(QUERY);
  if (query === undefined) return () => undefined;
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

function read(): boolean {
  return window.matchMedia?.(QUERY).matches === true;
}

/**
 * Whether the primary input cannot hover — a touch screen. Placement needs to know: with a
 * pointer, moving over the water already previews the drop, while a finger only ever arrives by
 * tapping, so the tap has to do the previewing before it is allowed to commit.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
