import "server-only"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { exchangeAuthCode } from "@/modules/db"
import { APP_ROUTES } from "@/modules/routes"

const destinationOf = (request: NextRequest): URL => {
    const requested = request.nextUrl.searchParams.get("next")
    const path = requested?.startsWith("/") && !requested.startsWith("//") ? requested : APP_ROUTES.home
    return new URL(path, request.nextUrl.origin)
}

/** Completes Supabase's PKCE exchange and returns only to a same-origin path. */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
    const destination = destinationOf(request)
    const code = request.nextUrl.searchParams.get("code")
    if (code === null) {
        destination.searchParams.set("auth", "invalid")
        return NextResponse.redirect(destination)
    }
    const exchanged = await exchangeAuthCode(code)
    if (exchanged.kind !== "ok") destination.searchParams.set("auth", exchanged.kind)
    return NextResponse.redirect(destination)
}
