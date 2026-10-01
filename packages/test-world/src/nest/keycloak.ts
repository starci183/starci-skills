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
