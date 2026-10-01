import "server-only"
import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./index"

/** The API, the health probe, framework files and files with an extension are never locale-negotiated. */
const UNNEGOTIATED = /^\/(?:api|health|_next|_vercel)(?:\/|$)|\.[^/]+$/

const negotiate = createMiddleware(routing)

/**
 * The one thing that runs before a route exists: deciding which language it is in. A request for `/browse`
 * carries no locale, so something has to choose one and send the reader to the addressed form - next-intl's
 * middleware reads the cookie, falls back to the default and redirects to the prefixed path. One routing
 * table for both apps, so `/vi` means the same thing on both origins.
 */
export const proxy = (request: NextRequest) =>
    UNNEGOTIATED.test(request.nextUrl.pathname) ? NextResponse.next() : negotiate(request)
