import * as React from "react"

const MOBILE_BREAKPOINT = 761

const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
};

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT
const getServerSnapshot = () => false

/** Whether the viewport is narrower than the layout's mobile breakpoint, kept in sync with the media query. */
export const useIsMobile = () => {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
};
