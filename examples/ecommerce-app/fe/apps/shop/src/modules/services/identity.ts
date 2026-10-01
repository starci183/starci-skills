import "server-only"
import { isRecord, parseOutcome, request, requestGraphql, type Outcome } from "@ecommerce/api"
import { IDENTITY_API_URL } from "../config"
import { readSessionToken } from "../session"
import { DOCUMENTS } from "./__generated__/documents"

/**
 * The signed-in shopper as the identity service reports it: the person id, the email the account
 * registered under, and whether the order service knows them as a buyer. The service keeps no
 * display name - the email is the whole of who it can name, so that is all this type claims.
 */
export type CurrentUser = {
    readonly id: string
    readonly email: string
    readonly hasOrders: boolean
}

/** The session `signIn` issues: the opaque bearer plus the person it authenticates. */
export type IssuedSession = {
    readonly sessionToken: string
    readonly personId: string
}

/** The identity service's account view: the person joined with their live buyer status. */
type AccountView = {
    readonly personId: string
    readonly email: string
    readonly hasOrders: boolean
}

/** The session of a `signIn` payload, or `null` when the payload is not that shape. */
const toIssuedSession = (data: unknown): IssuedSession | null =>
    isRecord(data) && typeof data.sessionToken === "string" && typeof data.personId === "string"
        ? { sessionToken: data.sessionToken, personId: data.personId }
        : null

/** The person id of a payload (a `register` answer, or a verified session), or `null` when it carries none. */
const toPersonId = (data: unknown): string | null =>
    isRecord(data) && typeof data.personId === "string" && data.personId !== "" ? data.personId : null

/** The account view of an `account` payload, or `null` when the payload is not that shape. */
const toAccountView = (data: unknown): AccountView | null =>
    isRecord(data) &&
    typeof data.personId === "string" &&
    typeof data.email === "string" &&
    typeof data.hasOrders === "boolean"
        ? { personId: data.personId, email: data.email, hasOrders: data.hasOrders }
        : null

/**
 * THE SETTLED CONTRACT - the landing -> shop session handoff, concretely.
 *
 * What the backend serves (`features/identity`): the anonymous GraphQL doors `register` and
 * `signIn` (email + password in; `signIn` answers an opaque bearer `sessionToken` + `personId`),
 * the person-keyed `account(personId)` query, and the internal machine doors
 * `internal/sessions/{verify,revoke}` that carry the bearer in a JSON body - the same doors the
 * order service's SessionGuard consumes.
 *
 * What this app does with them: the browser-facing door is the shop's own `/api/session` route
 * handler - the identity service serves no CORS, so the browser never crosses origins to it. On a
 * successful register or sign-in the handler stores the bearer in the `northwind-session` httpOnly
 * cookie (`modules/session`). Cookies do not bind to a port, so the same cookie accompanies the
 * browser between landing and shop on `localhost` - THAT is the handoff, with no token in a URL.
 *
 * Reading "who is this" is the two-hop machine question below: the cookie's bearer verifies at
 * `internal/sessions/verify`, and the person it names is read through `account(personId)`.
 */

/** `signIn`: check the pair and mint the session. A wrong pair refuses with `INVALID_CREDENTIALS`, naming neither half. */
export const signInWithPassword = async (email: string, password: string): Promise<Outcome<IssuedSession>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: IDENTITY_API_URL,
            document: DOCUMENTS.SignIn,
            variables: { input: { email, password } },
        }),
        toIssuedSession,
    )

/** `register`: create the account. A taken address refuses with `EMAIL_TAKEN`; the answer is the new person's id. */
export const registerAccount = async (email: string, password: string): Promise<Outcome<string>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: IDENTITY_API_URL,
            document: DOCUMENTS.Register,
            variables: { input: { email, password } },
        }),
        toPersonId,
    )

/**
 * `internal/sessions/verify`: the bearer in, the person behind a live session out. A refused token
 * (`SESSION_INVALID`) is a genuine anonymous answer - `null` - not a failure; only an unreachable
 * or mis-speaking door is a refusal.
 */
const verifySession = async (sessionToken: string): Promise<Outcome<string | null>> => {
    const outcome = parseOutcome(
        await request({
            url: `${IDENTITY_API_URL}/internal/sessions/verify`,
            method: "POST",
            body: { sessionToken },
        }),
        toPersonId,
    )
    return outcome.kind === "refused" ? { kind: "ok", data: null } : outcome
}

/** `account(personId)`: the person's own view, joining their live buyer status from the order service. */
const fetchAccount = async (personId: string): Promise<Outcome<AccountView>> =>
    parseOutcome(
        await requestGraphql({
            baseUrl: IDENTITY_API_URL,
            document: DOCUMENTS.Account,
            variables: { request: { personId } },
        }),
        toAccountView,
    )

/**
 * `internal/sessions/revoke`: end the session at the store that owns it. Best-effort on purpose -
 * the caller clears the local cookie either way, because a dead token must never trap it.
 */
export const revokeSession = async (sessionToken: string): Promise<void> => {
    await request({
        url: `${IDENTITY_API_URL}/internal/sessions/revoke`,
        method: "POST",
        body: { sessionToken },
    })
}

/**
 * Read the signed-in shopper, if there is one: the `northwind-session` cookie's bearer verifies at
 * the identity service, and the person it names is read through the `account` query. No cookie and
 * a dead cookie are the same anonymous answer; only a service that cannot answer is a refusal.
 */
export const fetchCurrentUser = async (): Promise<Outcome<CurrentUser | null>> => {
    const sessionToken = await readSessionToken()
    if (!sessionToken) return { kind: "ok", data: null }
    const verified = await verifySession(sessionToken)
    if (verified.kind !== "ok") return verified
    if (verified.data === null) return { kind: "ok", data: null }
    const account = await fetchAccount(verified.data)
    if (account.kind !== "ok") return account
    return {
        kind: "ok",
        data: { id: account.data.personId, email: account.data.email, hasOrders: account.data.hasOrders },
    }
}
