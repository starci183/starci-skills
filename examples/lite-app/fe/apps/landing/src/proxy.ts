import createMiddleware from "next-intl/middleware"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { refreshSession } from "@/modules/db/auth/read-session"
import { routing } from "@/modules/i18n"
import { APP_ROUTES } from "@/modules/routes"

const UNNEGOTIATED_ROOTS: ReadonlySet<string> = new Set(["auth", "health", "_next", "_vercel"])
const negotiate = createMiddleware(routing)

const firstSegment = (pathname: string): string => pathname.split("/")[1] ?? ""

const isUnnegotiated = (pathname: string): boolean => {
    const last = pathname.split("/").at(-1) ?? ""
    return UNNEGOTIATED_ROOTS.has(firstSegment(pathname)) || (last.includes(".") && !last.endsWith("."))
}

const isPublic = (pathname: string): boolean =>
    pathname === "/" || pathname === `/${routing.defaultLocale}` || isUnnegotiated(pathname)

/** Refreshes the Supabase session, gates private paths with verified claims, then returns locale routing. */
export const proxy = async (request: NextRequest): Promise<NextResponse> => {
    const response = isUnnegotiated(request.nextUrl.pathname) ? NextResponse.next() : negotiate(request)
    const principal = await refreshSession(request, response)
    if (principal.kind === "ok" || isPublic(request.nextUrl.pathname)) return response
    const destination = request.nextUrl.clone()
    destination.pathname = APP_ROUTES.home
    destination.searchParams.set("next", request.nextUrl.pathname)
    const redirect = NextResponse.redirect(destination)
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie)
    return redirect
}

export const config = {
    matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}
