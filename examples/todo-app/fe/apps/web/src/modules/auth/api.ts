import { isRecord, parseOutcome, request } from "@/modules/api"
import { SIGN_IN_REFUSAL_MESSAGE } from "./refusal"

/**
 * br.login.password.sign-in: a refusal must not say which half of the pair was wrong. This module
 * normalizes any refused sign-in - unknown email or wrong password alike - into the same message, so
 * the distinction never reaches a caller that could render it differently.
 */

/** The one value a successful sign-in call returns: the session token. */
interface SignInResult {
    readonly token: string
}

/** The session token of a sign-in payload, or `null` when the payload carries none. */
const toSignInResult = (data: unknown): SignInResult | null =>
    isRecord(data) && typeof data.sessionToken === "string" ? { token: data.sessionToken } : null

/** Whether a sign-out payload says the session ended. */
const toSignedOut = (data: unknown): boolean | null =>
    isRecord(data) && typeof data.signedOut === "boolean" ? data.signedOut : null

/** The one sign-in call; every refusal reason it can hit collapses to SIGN_IN_REFUSAL_MESSAGE. */
export const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const outcome = parseOutcome(
        await request({ operation: "SignIn", variables: { input: { email, password } } }),
        toSignInResult,
    )
    if (outcome.kind !== "ok") throw new Error(SIGN_IN_REFUSAL_MESSAGE, { cause: new Error(outcome.kind) })
    return outcome.data
}

/**
 * Ends a session by its token. Best-effort from the caller's point of view: the local session is
 * cleared either way (`modules/session`'s `clearToken`), so a network failure here never traps the
 * reader signed in on their own screen.
 */
export const signOut = async (token: string): Promise<boolean> => {
    const outcome = parseOutcome(
        await request({ operation: "SignOut", variables: { input: { sessionToken: token } } }),
        toSignedOut,
    )
    return outcome.kind === "ok" && outcome.data
}
