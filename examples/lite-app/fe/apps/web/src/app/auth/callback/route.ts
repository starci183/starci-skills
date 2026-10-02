import "server-only"

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { exchangeAuthCode } from "@/modules/db"
import { safeNextPath } from "@/modules/routes"

const destinationOf = (request: NextRequest): URL => {
    const path = safeNextPath(request.nextUrl.searchParams.get("next"), request.nextUrl.origin)
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
