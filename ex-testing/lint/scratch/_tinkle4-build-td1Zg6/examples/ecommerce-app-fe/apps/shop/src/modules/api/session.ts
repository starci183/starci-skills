import type { Result } from "./result"

/** Which account act a submit is for: an existing pair, or a fresh registration. */
export type SessionMode = "sign-in" | "register"

/** The JSON shape the shop's own `/api/session` door answers. */
type SessionDoorBody = {
    readonly ok?: boolean
    readonly code?: string
    readonly reason?: string
}

/**
 * The shop's OWN session door (`/api/session`), not a backend service: the form posts the pair
 * here and the route handler is what talks to the identity service — the browser never crosses
 * origins (identity serves no CORS), so this module is the one named call a form is allowed to
 * make about a session. Same never-throws `Result` shape as the backend transport, with the door's
 * business code forwarded so the form maps it to dictionary copy.
 */
export const openSession = async (mode: SessionMode, email: string, password: string): Promise<Result<null>> => {
    try {
        const response = await fetch("/api/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode, email, password }),
        })
        const body = (await response.json().catch(() => null)) as SessionDoorBody | null
        if (body?.ok === true) return { ok: true, data: null }
        return {
            ok: false,
            reason: typeof body?.reason === "string" ? body.reason : `the session door answered ${response.status}`,
            code: typeof body?.code === "string" ? body.code : undefined,
        }
    } catch {
        return { ok: false, reason: "the session door could not be reached" }
    }
}

/**
 * End the session through the same door. Best-effort from the caller's point of view: the handler
 * clears the local cookie whether or not the upstream revoke answered, so a network failure here
 * never traps the reader signed in on their own screen.
 */
export const closeSession = async (): Promise<boolean> => {
    try {
        const response = await fetch("/api/session", { method: "DELETE" })
        return response.ok
    } catch {
        return false
    }
}
