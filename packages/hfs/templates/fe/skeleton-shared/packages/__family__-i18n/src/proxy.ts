import createMiddleware from "next-intl/middleware"
import type { defineRouting } from "next-intl/routing"
import { NextResponse, type NextRequest } from "next/server"

/** The API, the health probe, framework files and files with an extension are never locale-negotiated. */
const UNNEGOTIATED = /^\/(?:api|health|_next|_vercel)(?:\/|$)|\.[^/]+$/

/** The proxy of an app: negotiates the locale and redirects, and lets everything that is not a page through untouched. */
export const createProxy = (routing: ReturnType<typeof defineRouting>) => {
    const negotiate = createMiddleware(routing)
    return (request: NextRequest) => (UNNEGOTIATED.test(request.nextUrl.pathname) ? NextResponse.next() : negotiate(request))
}
