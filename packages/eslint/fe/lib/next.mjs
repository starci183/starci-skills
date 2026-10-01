/**
 * Next.js's own contract for route segment files, read from the runtime's one statement of it
 * (`scripts/lib/next-contract.mjs`, shipped in `runtime/` by `scripts/hfs/sync-runtime.mjs`), so every law
 * holds the same list by construction.
 */
export { NEXT_RESERVED_EXPORTS, NEXT_ROUTE_SEGMENT_STEMS } from "../runtime/scripts/lib/next-contract.mjs"
