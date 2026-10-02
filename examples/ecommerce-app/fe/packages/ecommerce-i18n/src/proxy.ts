import "server-only"
import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./routing"

/** The first path segments of the API, the health probe and the framework: never locale-negotiated. */
const UNNEGOTIATED_ROOTS: ReadonlySet<string> = new Set(["api", "health", "_next", "_vercel"])

/** Whether the path belongs to the API, the health probe, the framework or a file with an extension. */
const isUnnegotiated = (pathname: string): boolean => {
    const segments = pathname.split("/")
    const last = segments.at(-1) ?? ""
    return UNNEGOTIATED_ROOTS.has(segments[1] ?? "") || (last.includes(".") && !last.endsWith("."))
}

const negotiate = createMiddleware(routing)

/**
 * The one thing that runs before a route exists: deciding which language it is in. A request for `/browse`
 * carries no locale, so something has to choose one and send the reader to the addressed form - next-intl's
 * middleware reads the cookie, falls back to the default and redirects to the prefixed path. One routing
 * table for both apps, so `/vi` means the same thing on both origins.
 */
export const proxy = (request: NextRequest) =>
    isUnnegotiated(request.nextUrl.pathname) ? NextResponse.next() : negotiate(request)
