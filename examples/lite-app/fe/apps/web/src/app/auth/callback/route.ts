import { NextResponse } from "next/server"
import { exchangeAuthCode } from "@/modules/auth/server"
import { APP_ROUTES } from "@/modules/routes"

/** The Supabase PKCE callback only exchanges the code and redirects home. */
export async function GET(request: Request): Promise<NextResponse> {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    if (code) await exchangeAuthCode(code)
    return NextResponse.redirect(new URL(APP_ROUTES.home, url.origin))
}
