/** Liveness is answered per request, never prerendered at build time. */
export const dynamic = "force-dynamic"

/** Process-local liveness; it never touches a dependency. */
export const GET = (): Response => Response.json({ status: "ok", info: {}, error: {}, details: {} })
