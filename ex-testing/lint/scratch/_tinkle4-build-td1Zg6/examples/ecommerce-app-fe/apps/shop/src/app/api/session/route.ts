import { NextResponse } from "next/server"
import {
    registerAccount, revokeSession, signInWithPassword 
} from "../../../modules/api/identity"
import {
    readSessionToken, SESSION_COOKIE_OPTIONS 
} from "../../../modules/session"
import {
    PERSON_COOKIE, SESSION_COOKIE 
} from "../../../modules/session/shared"

/** The body's honest floor: a mode this door serves plus the two credential halves. */
type SessionRequestBody = {
  readonly mode?: unknown;
  readonly email?: unknown;
  readonly password?: unknown;
};

/** The identity refusal's HTTP status at this door: the business code mapped once, never re-derived per call site. */
const refusalStatus = (code: string | undefined): number => {
    if (code === "REQUEST_INVALID") return 400
    if (code === "INVALID_CREDENTIALS") return 401
    if (code === "EMAIL_TAKEN") return 409
    return 502
}

/** An upstream refusal as this door forwards it: the human reason plus the business code the form maps to copy. */
type SessionRefusal = {
    readonly reason: string
    readonly code?: string
}

/** Forward an upstream refusal: its status, its business code for the form's copy, and the reason it arrived with. */
const refused = (result: SessionRefusal): Response =>
    NextResponse.json(
        { ok: false, code: result.code ?? "IDENTITY_UNAVAILABLE", reason: result.reason },
        { status: refusalStatus(result.code) },
    )

/**
 * POST `/api/session` — the shop's browser-facing session door, the one place the form may speak
 * to. `sign-in` checks the pair at the identity service's `signIn` door; `register` runs the
 * `register` door first and signs in behind it, because registration issues no session of its own.
 * On success the minted bearer lands in the `northwind-session` httpOnly cookie — the whole of the
 * landing → shop handoff, since the cookie is host-scoped and ports do not divide it.
 */
export const POST = async (request: Request): Promise<Response> => {
    let body: SessionRequestBody
    try {
        body = (await request.json()) as SessionRequestBody
    } catch {
        body = {}
    }
    const mode = body.mode === "sign-in" || body.mode === "register" ? body.mode : null
    const email = typeof body.email === "string" ? body.email : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (mode === null || !email || !password) {
        return NextResponse.json(
            { ok: false, code: "REQUEST_INVALID", reason: "A mode, an email and a password are required." },
            { status: 400 },
        )
    }
    if (mode === "register") {
        const registered = await registerAccount(email, password)
        if (!registered.ok) return refused(registered)
    }
    const issued = await signInWithPassword(email, password)
    if (!issued.ok) return refused(issued)
    const response = NextResponse.json({ ok: true })
    response.cookies.set(SESSION_COOKIE, issued.data.sessionToken, SESSION_COOKIE_OPTIONS)
    response.cookies.set(PERSON_COOKIE, issued.data.personId, SESSION_COOKIE_OPTIONS)
    return response
}

/**
 * DELETE `/api/session` — end the session: the bearer is revoked at the identity service's
 * `internal/sessions/revoke` door first and the local cookie cleared second. The revoke is
 * best-effort — a dead token must never trap the cookie on the browser.
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
