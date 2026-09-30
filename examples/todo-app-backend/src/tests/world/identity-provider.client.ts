/**
 * The world's door to the REAL identity provider (the stack's Keycloak, its realm imported exactly as the dev stack
 * imports it): where the token endpoint is, which realm and client the stack declares, and the admin call that registers a
 * person. The provider is never faked: a sign-in of the app under test is a real password grant.
 */
import { readFileSync } from "node:fs"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import { portOf, serviceOf } from "./stack.client"
import type { StackService, TestStack } from "./stack.client"

const IMPORT_DIRECTORY = "/opt/keycloak/data/import/"
const ADMIN_REALM = "master"
const ADMIN_CLIENT = "admin-cli"
const CALL_TIMEOUT_MS = 30_000
const CREATED = 201

/** What the imported realm declares that the world needs: its name and the client the app signs in with. */
export interface ImportedRealm {
    /** The realm name. */
    readonly realm: string
    /** The public client of the realm. */
    readonly clientId: string
}

const failed = (detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.InfrastructureFailed, params: { detail }, cause })

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The realm the stack's Keycloak imports at start (the mounted `realm-*.json`): its name and its first client. */
export const importedRealmOf = (keycloak: StackService): ImportedRealm => {
    const mount = keycloak.mounts.find((candidate) => candidate.container.startsWith(IMPORT_DIRECTORY))
    if (mount === undefined) throw failed("the stack's Keycloak mounts no realm import file")
    const parsed: unknown = JSON.parse(readFileSync(mount.host, "utf8"))
    if (!isRecord(parsed) || typeof parsed.realm !== "string" || !Array.isArray(parsed.clients)) throw failed(`${mount.host} is not a realm export`)
    const [client] = parsed.clients
    if (!isRecord(client) || typeof client.clientId !== "string") throw failed(`${mount.host} declares no client`)
    return { realm: parsed.realm, clientId: client.clientId }
}

/** Where the provider listens for a caller: `proxied` for the app under test (failure injection), else the direct port. */
export const providerUrl = (stack: TestStack, proxied: boolean): string => {
    const port = portOf(serviceOf(stack, "keycloak"))
    return `http://${port.host}:${proxied ? port.proxy : port.direct}`
}

/** The token endpoint of the imported realm, as the app is configured with it. */
export const tokenUrlOf = (baseUrl: string, realm: string): string => `${baseUrl}/realms/${realm}/protocol/openid-connect/token`

const adminToken = async (stack: TestStack): Promise<string> => {
    const { environment } = serviceOf(stack, "keycloak")
    const response = await fetch(tokenUrlOf(providerUrl(stack, false), ADMIN_REALM), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "password",
            client_id: ADMIN_CLIENT,
            username: environment.KEYCLOAK_ADMIN ?? "",
            password: environment.KEYCLOAK_ADMIN_PASSWORD ?? "",
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    const body: unknown = await response.json()
    if (!response.ok || !isRecord(body) || typeof body.access_token !== "string") throw failed(`the provider refused the admin sign-in (${response.status})`)
    return body.access_token
}

/** Registers a person at the provider (admin API, direct port) and answers the person id its tokens carry as `sub`. */
export const registerPerson = async (stack: TestStack, realm: string, email: string, password: string): Promise<string> => {
    const response = await fetch(`${providerUrl(stack, false)}/admin/realms/${realm}/users`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await adminToken(stack)}` },
        body: JSON.stringify({
            username: email,
            email,
            firstName: "E2E",
            lastName: "Person",
            enabled: true,
            emailVerified: true,
            requiredActions: [],
            credentials: [{ type: "password", value: password, temporary: false }],
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    })
    const location = response.headers.get("location")
    const personId = location?.split("/").at(-1)
    if (response.status !== CREATED || personId === undefined || personId === "") throw failed(`the provider did not register ${email} (${response.status})`)
    return personId
}
