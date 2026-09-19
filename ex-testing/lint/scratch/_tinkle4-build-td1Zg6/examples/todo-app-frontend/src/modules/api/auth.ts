import { graphql } from "./graphql"

/**
 * br.login.password.sign-in: a refusal must not say which half of the pair was wrong. This module
 * normalizes any refused sign-in - unknown email or wrong password alike - into the same message, so
 * the distinction never reaches a caller that could render it differently. Unchanged from the former
 * REST-backed version; only the transport underneath (`graphql.ts`) moved.
 */
export const SIGN_IN_REFUSAL_MESSAGE = "That email and password do not match."

/** The one value a successful sign-in call returns: the session token. */
export interface SignInResult {
  readonly token: string;
}

const SIGN_IN_DOCUMENT = "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }"

/** The one sign-in call; every refusal reason it can hit collapses to SIGN_IN_REFUSAL_MESSAGE. */
export const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const result = await graphql<{ sessionToken: string; personId: string }>(SIGN_IN_DOCUMENT, { input: { email, password } })
    if (!result.ok) {
        throw new Error(SIGN_IN_REFUSAL_MESSAGE, { cause: new Error(result.reason) })
    }
    return { token: result.data.sessionToken }
}

const SIGN_OUT_DOCUMENT = "mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }"

/** Ends a session by its token. Best-effort from the caller's point of view: the local session is
 * cleared either way (`modules/session`'s `clearToken`), so a network failure here never traps the
 * reader signed in on their own screen. */
export const signOut = async (token: string): Promise<boolean> => {
    const result = await graphql<{ signedOut: boolean }>(SIGN_OUT_DOCUMENT, { input: { sessionToken: token } })
    return result.ok && result.data.signedOut
}
