import { useMemo, useSyncExternalStore } from "react";

/** Live value of a CSS media query. */
export function useMediaQuery(query: string) {
  const subscribe = useMemo(
    () => (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
