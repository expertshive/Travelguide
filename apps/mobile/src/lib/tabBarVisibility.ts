import { useSyncExternalStore } from 'react';

let hidden = false;
const listeners = new Set<() => void>();

export function setTabBarHidden(value: boolean): void {
  if (hidden === value) return;
  hidden = value;
  listeners.forEach((fn) => fn());
}

export function useTabBarHidden(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => hidden,
    () => false,
  );
}
