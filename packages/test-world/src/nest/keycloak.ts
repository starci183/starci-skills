/**
 * The identity provider is REAL: the repository's realm is imported into the shared Keycloak (one realm per repository),
 * and a spec registers persons through the admin REST API. Admin calls go to the container's own port, never through
 * toxiproxy, so an outage a spec injects on the proxy cannot break the world's own bookkeeping.
 */
import { TestWorldErrorCode, worldError } from "../errors"
import type { RunKeycloak } from "../stack/contracts"

const TIMEOUT_MS = 30_000

/** The admin handle of one repository realm. */
export interface KeycloakAdmin {
    /** Registers a user in the realm and answers its id (the `sub` of every token it gets). */
    person(email: string, password: string): Promise<string>
    /** Deletes a user by id. */
    remove(personId: string): Promise<void>
    /** Rotates the secret of a client of the realm and answers the new value. */
    rotateClientSecret(client: string): Promise<string>
    /** The password grant of the realm's public client: the access token of a registered person. */
    token(email: string, password: string): Promise<string>
    /** The user events the realm stored for a person, newest first (the realm import enables events). */
    events(personId: string): Promise<ReadonlyArray<KeycloakEvent>>
    /** The live sessions of a person in the realm. */
    sessions(personId: string): Promise<ReadonlyArray<KeycloakSession>>
}

/** One user event the realm stored: what the provider did for a person (LOGIN, LOGIN_ERROR, LOGOUT, ...). */
export interface KeycloakEvent {
    /** The event type. */
    readonly type: string
    /** The user the event is about, when there is one. */
    readonly userId: string | null
    /** The client that caused it, when there is one. */
    readonly clientId: string | null
    /** The Keycloak session it belongs to, when there is one. */
    readonly sessionId: string | null
    /** The error of a failed event (`invalid_user_credentials`, ...), when there is one. */
    readonly error: string | null
    /** When it happened, epoch milliseconds. */
    readonly time: number
}

/** One live session of a person in the realm. */
export interface KeycloakSession {
    /** The session id. */
    readonly id: string
    /** The clients that hold tokens of the session (their clientId). */
    readonly clientIds: ReadonlyArray<string>
}

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null)
const recordsOf = (value: unknown): ReadonlyArray<Record<string, unknown>> =>
    Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null) : []

/** A GET of the realm's admin API, answered as JSON; a non-200 answer is a world failure naming `what`. */
const adminRead = async (run: RunKeycloak, path: string, what: string): Promise<unknown> => {
    const token = await adminToken(run)
    const response = await fetch(`http://127.0.0.1:${run.directPort}/admin/realms/${run.realm}${path}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status !== 200) throw worldError(TestWorldErrorCode.InfrastructureFailed, `reading ${what} of ${run.realm} answered ${response.status}`)
    return response.json()
}

const adminToken = async (run: RunKeycloak): Promise<string> => {
    const response = await fetch(`http://127.0.0.1:${run.directPort}/realms/master/protocol/openid-connect/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: run.adminUser, password: run.adminPassword }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status !== 200) throw worldError(TestWorldErrorCode.InfrastructureFailed, `the Keycloak admin token answered ${response.status}`)
    return ((await response.json()) as { access_token: string }).access_token
}

/** Builds the admin handle of the run's realm. */
export const createKeycloakAdmin = (run: RunKeycloak): KeycloakAdmin => ({
    person: async (email, password) => {
        const token = await adminToken(run)
        const response = await fetch(`http://127.0.0.1:${run.directPort}/admin/realms/${run.realm}/users`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({
                username: email,
                email,
                enabled: true,
                emailVerified: true,
                firstName: "E2E",
                lastName: "Person",
                requiredActions: [],
                credentials: [{ type: "password", value: password, temporary: false }],
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (response.status !== 201) {
            throw worldError(TestWorldErrorCode.SignInRefused, `Keycloak refused to create ${email} in ${run.realm}: ${response.status} ${(await response.text()).slice(0, 500)}`)
        }
        const location = response.headers.get("location") ?? ""
        const personId = location.slice(location.lastIndexOf("/") + 1)
        if (personId === "") throw worldError(TestWorldErrorCode.SignInRefused, `Keycloak answered no user id for ${email}`)
        return personId
    },
    rotateClientSecret: async (client) => {
        const token = await adminToken(run)
        const headers = { authorization: `Bearer ${token}` }
        const base = `http://127.0.0.1:${run.directPort}/admin/realms/${run.realm}/clients`
        const found = await fetch(`${base}?clientId=${encodeURIComponent(client)}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
        const clients = (await found.json()) as Array<{ id: string }>
        const id = clients[0]?.id
        if (id === undefined) throw worldError(TestWorldErrorCode.NotDeclared, `the client ${client} is not in the realm ${run.realm}`)
        const rotated = await fetch(`${base}/${id}/client-secret`, { method: "POST", headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (rotated.status !== 200) throw worldError(TestWorldErrorCode.InfrastructureFailed, `rotating the secret of ${client} answered ${rotated.status}`)
        return ((await rotated.json()) as { value: string }).value
    },
    remove: async (personId) => {
        const token = await adminToken(run)
        await fetch(`http://127.0.0.1:${run.directPort}/admin/realms/${run.realm}/users/${personId}`, {
            method: "DELETE",
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
    },
    events: async (personId) =>
        recordsOf(await adminRead(run, `/events?user=${encodeURIComponent(personId)}&max=1000`, `the events of ${personId}`)).map((event) => ({
            type: String(event.type),
            userId: textOrNull(event.userId),
            clientId: textOrNull(event.clientId),
            sessionId: textOrNull(event.sessionId),
            error: textOrNull(event.error),
            time: typeof event.time === "number" ? event.time : 0,
        })),
    sessions: async (personId) =>
        recordsOf(await adminRead(run, `/users/${encodeURIComponent(personId)}/sessions`, `the sessions of ${personId}`)).map((session) => ({
            id: String(session.id),
            clientIds: typeof session.clients === "object" && session.clients !== null ? Object.values(session.clients as Record<string, unknown>).map(String) : [],
        })),
    token: async (email, password) => {
        const response = await fetch(`http://127.0.0.1:${run.port}/realms/${run.realm}/protocol/openid-connect/token`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "password", client_id: run.clientId, username: email, password }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (response.status !== 200) throw worldError(TestWorldErrorCode.SignInRefused, `the password grant for ${email} answered ${response.status}`)
        return ((await response.json()) as { access_token: string }).access_token
    },
})
