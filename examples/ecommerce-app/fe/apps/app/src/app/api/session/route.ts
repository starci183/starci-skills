import { NextResponse } from "next/server"
import { isRecord } from "@ecommerce/api"
import { readBody, registerAccount, respond, revokeSession, signInWithPassword } from "../../../modules/services"
import { PERSON_COOKIE, readSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "../../../modules/session"

/**
 * POST `/api/session` - the shop's browser-facing session door, the one place the form may speak to.
 * `sign-in` checks the pair at the identity service's `signIn` door; `register` runs the `register` door
 * first and signs in behind it, because registration issues no session of its own. On success the minted
 * bearer lands in the `northwind-session` httpOnly cookie - the whole of the landing -> shop handoff, since
 * the cookie is host-scoped and ports do not divide it.
 */
export const POST = async (request: Request): Promise<Response> => {
    const body = await readBody(request)
    const mode = isRecord(body) && (body.mode === "sign-in" || body.mode === "register") ? body.mode : null
    const email = isRecord(body) && typeof body.email === "string" ? body.email : ""
    const password = isRecord(body) && typeof body.password === "string" ? body.password : ""
    if (mode === null || !email || !password) return respond({ kind: "invalid", code: "REQUEST_INVALID" })
    if (mode === "register") {
        const registered = await registerAccount(email, password)
        if (registered.kind !== "ok") return respond(registered)
    }
    const issued = await signInWithPassword(email, password)
    if (issued.kind !== "ok") return respond(issued)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, issued.data.sessionToken, SESSION_COOKIE_OPTIONS)
    response.cookies.set(PERSON_COOKIE, issued.data.personId, SESSION_COOKIE_OPTIONS)
    return response
}

/**
 * DELETE `/api/session` - end the session: the bearer is revoked at the identity service's
 * `revokeSession` door first and the local cookie cleared second. The revoke is
 * best-effort - a dead token must never trap the cookie on the browser.
 */
export const DELETE = async (): Promise<Response> => {
    const sessionToken = await readSessionToken()
    if (sessionToken) await revokeSession(sessionToken)
    const response = NextResponse.json({ ok: true })
    const expired = { ...SESSION_COOKIE_OPTIONS, maxAge: 0 }
    response.cookies.set(SESSION_COOKIE, "", expired)
    response.cookies.set(PERSON_COOKIE, "", expired)
    return response
}
