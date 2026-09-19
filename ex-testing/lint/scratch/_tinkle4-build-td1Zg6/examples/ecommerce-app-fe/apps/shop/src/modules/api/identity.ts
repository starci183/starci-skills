import "server-only"
import { IDENTITY_API_URL } from "../config"
import { readSessionToken } from "../session"
import { postGraphql } from "./graphql"
import { postJson } from "./http"
import type { Result } from "./result"

/**
 * The signed-in shopper as the identity service reports it: the person id, the email the account
 * registered under, and whether the order service knows them as a buyer. The service keeps no
 * display name — the email is the whole of who it can name, so that is all this type claims.
 */
export type CurrentUser = {
  readonly id: string;
  readonly email: string;
  readonly hasOrders: boolean;
};

/** The session `signIn` issues: the opaque bearer plus the person it authenticates. */
export type IssuedSession = {
  readonly sessionToken: string;
  readonly personId: string;
};

/** A successful registration: the new person's id. The register door issues no session of its own. */
export type RegisteredAccount = {
  readonly personId: string;
};

/** The person a live session verifies to. */
export type VerifiedSession = {
  readonly personId: string;
};

/** The identity service's account view: the person joined with their live buyer status. */
export type AccountView = {
  readonly personId: string;
  readonly email: string;
  readonly hasOrders: boolean;
};

const SIGN_IN_DOCUMENT =
    "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }"

const REGISTER_DOCUMENT =
    "mutation Register($input: RegisterInput!) { register(input: $input) { personId } }"

const ACCOUNT_DOCUMENT =
    "query Account($personId: ID!) { account(personId: $personId) { personId email hasOrders } }"

/**
 * THE SETTLED CONTRACT — the landing → shop session handoff, concretely.
 *
 * What the backend serves (`features/identity`): the anonymous GraphQL doors `register` and
 * `signIn` (email + password in; `signIn` answers an opaque bearer `sessionToken` + `personId`),
 * the person-keyed `account(personId)` query, and the internal machine doors
 * `internal/sessions/{verify,revoke}` that carry the bearer in a JSON body — the same doors the
 * order service's SessionGuard consumes.
 *
 * What this app does with them: the browser-facing door is the shop's own `/api/session` route
 * handler — the identity service serves no CORS, so the browser never crosses origins to it. On a
 * successful register or sign-in the handler stores the bearer in the `northwind-session` httpOnly
 * cookie (`modules/session.ts`). Cookies do not bind to a port, so the same cookie accompanies the
 * browser between landing and shop on `localhost` — THAT is the handoff, with no token in a URL.
 *
 * Reading "who is this" is the two-hop machine question below: the cookie's bearer verifies at
 * `internal/sessions/verify`, and the person it names is read through `account(personId)`.
 */

/** `signIn`: check the pair and mint the session. A wrong pair refuses with `INVALID_CREDENTIALS`, naming neither half. */
export const signInWithPassword = async (email: string, password: string): Promise<Result<IssuedSession>> =>
    postGraphql<{ signIn: IssuedSession }>(IDENTITY_API_URL, SIGN_IN_DOCUMENT, { input: { email, password } }, null)
        .then((result) => (result.ok ? { ok: true, data: result.data.signIn } : result))

/** `register`: create the account. A taken address refuses with `EMAIL_TAKEN`. */
export const registerAccount = async (email: string, password: string): Promise<Result<RegisteredAccount>> =>
    postGraphql<{ register: RegisteredAccount }>(IDENTITY_API_URL, REGISTER_DOCUMENT, { input: { email, password } }, null)
        .then((result) => (result.ok ? { ok: true, data: result.data.register } : result))

/**
 * `internal/sessions/verify`: the bearer in, the person behind a live session out. A refused token
 * (`SESSION_INVALID`) is a genuine anonymous answer — `null` — not a failure; only an unreachable
 * or mis-speaking door is a refusal.
 */
export const verifySession = async (sessionToken: string): Promise<Result<VerifiedSession | null>> => {
    const result = await postJson<Partial<VerifiedSession>>(`${IDENTITY_API_URL}/internal/sessions/verify`, { sessionToken })
    if (!result.ok) {
        return result.code === "SESSION_INVALID" ? { ok: true, data: null } : result
    }
    if (typeof result.data.personId !== "string" || !result.data.personId) {
        return { ok: false, reason: "the verify door answered without a person" }
    }
    return { ok: true, data: { personId: result.data.personId } }
}

/** `account(personId)`: the person's own view, joining their live buyer status from the order service. */
export const fetchAccount = async (personId: string): Promise<Result<AccountView>> =>
    postGraphql<{ account: AccountView }>(IDENTITY_API_URL, ACCOUNT_DOCUMENT, { personId }, null)
        .then((result) => (result.ok ? { ok: true, data: result.data.account } : result))

/**
 * `internal/sessions/revoke`: end the session at the store that owns it. Best-effort on purpose —
 * the caller clears the local cookie either way, because a dead token must never trap it.
 */
export const revokeSession = async (sessionToken: string): Promise<void> => {
    await postJson(`${IDENTITY_API_URL}/internal/sessions/revoke`, { sessionToken })
}

/**
 * Read the signed-in shopper, if there is one: the `northwind-session` cookie's bearer verifies at
 * the identity service, and the person it names is read through the `account` query. No cookie and
 * a dead cookie are the same anonymous answer; only a service that cannot answer is a refusal.
 */
export const fetchCurrentUser = async (): Promise<Result<CurrentUser | null>> => {
    const sessionToken = await readSessionToken()
    if (!sessionToken) return { ok: true, data: null }
    const verified = await verifySession(sessionToken)
    if (!verified.ok) return verified
    if (verified.data === null) return { ok: true, data: null }
    const account = await fetchAccount(verified.data.personId)
    if (!account.ok) return account
    return {
        ok: true,
        data: { id: account.data.personId, email: account.data.email, hasOrders: account.data.hasOrders },
    }
}
