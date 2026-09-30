// next-contract.mjs - Next.js's own contract for route segment files, stated once. The architecture machine
// (scripts/checks/code-patterns/next.mjs) and @starci/eslint-canon-fe (its runtime/ copy, lib/next.mjs) read it here, so a
// naming or aliasing law never asks an author to spell a framework-reserved export differently.

/** Exports Next reads by name from a route segment file. */
export const NEXT_RESERVED_EXPORTS = Object.freeze(new Set([
  'dynamic', 'dynamicParams', 'fetchCache', 'generateMetadata', 'generateStaticParams', 'generateViewport',
  'maxDuration', 'metadata', 'preferredRegion', 'revalidate', 'runtime', 'viewport',
]));

/** The file stems Next mounts as a segment file under a route tree. */
export const NEXT_ROUTE_SEGMENT_STEMS = Object.freeze(new Set([
  'default', 'error', 'global-error', 'layout', 'loading', 'not-found', 'page', 'route', 'template',
]));
