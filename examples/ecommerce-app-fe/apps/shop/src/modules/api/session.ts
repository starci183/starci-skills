import { deleteJson, postJson } from "./client"
import type { Result } from "./outcome"

/** Which account act a submit is for: an existing pair, or a fresh registration. */
export type SessionMode = "sign-in" | "register"

/** The shop's own session door: the route handler that talks to the identity service. */
const SESSION_DOOR = "/api/session"

/**
 * The shop's OWN session door (`/api/session`), not a backend service: the form posts the pair
 * here and the route handler is what talks to the identity service - the browser never crosses
 * origins (identity serves no CORS), so this module is the one named call a form is allowed to
 * make about a session. Same never-throws `Result` shape as the backend transport, with the door's
 * business code forwarded so the form maps it to dictionary copy.
 */
export const openSession = async (mode: SessionMode, email: string, password: string): Promise<Result<unknown>> =>
    postJson(SESSION_DOOR, { mode, email, password })

/**
 * End the session through the same door. Best-effort from the caller's point of view: the handler
 * clears the local cookie whether or not the upstream revoke answered, so a network failure here
 * never traps the reader signed in on their own screen.
 */
export const closeSession = async (): Promise<boolean> => (await deleteJson(SESSION_DOOR)).ok
