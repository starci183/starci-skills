import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { routing } from "@/modules/i18n"

/** The paths outside locale routing: the liveness route and the framework's own assets. */
const UNNEGOTIATED_ROOTS: ReadonlySet<string> = new Set(["health", "_next", "_vercel"])
const negotiate = createMiddleware(routing)

const firstSegment = (pathname: string): string => pathname.split("/")[1] ?? ""

const isUnnegotiated = (pathname: string): boolean => {
    const last = pathname.split("/").at(-1) ?? ""
    return UNNEGOTIATED_ROOTS.has(firstSegment(pathname)) || (last.includes(".") && !last.endsWith("."))
}

/**
 * Locale routing only. The session lives in the browser (modules/auth) and the back end verifies the access token of
 * every call, so the proxy neither reads nor refreshes it.
 */
export const proxy = (request: NextRequest): NextResponse =>
    isUnnegotiated(request.nextUrl.pathname) ? NextResponse.next() : negotiate(request)

/** Routes that pass through locale negotiation. */
export const config = {
    matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
