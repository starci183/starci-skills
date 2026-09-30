/**
 * Next.js's own contract for route segment files, the one place the front-end laws read it.
 *
 * The export names below are reserved by the framework: a segment file must spell them exactly, so a
 * naming or aliasing law cannot ask the author to write them differently. The list is the same one the
 * architecture machine holds (`NEXT_RESERVED_EXPORTS` in `scripts/checks/code-patterns/next.mjs`).
 */

/** Exports Next reads by name from a route segment file. */
export const NEXT_RESERVED_EXPORTS = Object.freeze(new Set([
  "dynamic", "dynamicParams", "fetchCache", "generateMetadata", "generateStaticParams", "generateViewport",
  "maxDuration", "metadata", "preferredRegion", "revalidate", "runtime", "viewport",
]))

/** The file stems Next mounts as a segment file under a route tree. */
export const NEXT_ROUTE_SEGMENT_STEMS = Object.freeze(new Set([
  "default", "error", "global-error", "layout", "loading", "not-found", "page", "route", "template",
]))
