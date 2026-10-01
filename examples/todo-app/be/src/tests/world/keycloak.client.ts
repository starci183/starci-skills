/**
 * The real Keycloak of the run, reached over HTTP: the realm the stack imports (`.starcistacks/dev/infra/compose/
 * realm-todo.json`, read here for its name and the client the api presents), the readiness of that realm, and the admin API
 * a spec uses to register a person the identity provider then vouches for. Nothing of the provider is imitated: the api's
 * own Keycloak client signs in against this server.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createE2EHttpClient } from "@tests/world/kit/e2e-http-client"
import { isRecord } from "@modules/platform/primitives"
import { KEYCLOAK_ADMIN_USER } from "./docker.client"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const ADMIN_TIMEOUT_MS = 30_000
const HTTP_CREATED = 201
const HTTP_OK = 200

/** The realm export the dev stack imports; the world's Keycloak imports the same file. */
export const REALM_FILE = join(
    __dirname,
    "..",
    "..",
    "..",
    ".starcistacks",
    "dev",
    "infra",
    "compose",
    "realm-todo.json",
)

/** What the world reads out of the realm export: the realm and the client the api signs in with. */
export interface KeycloakRealm {
    /** The realm name. */
    readonly realm: string
    /** The public client with direct access grants the api presents. */
    readonly clientId: string
}

/** Where the Keycloak of the run listens and how its administrator signs in. */
export interface KeycloakEndpoint {
    /** The loopback base URL of the server. */
    readonly baseUrl: string
    /** The realm the api signs in against. */
    readonly realm: string
    /** The password of the bootstrap administrator. */
    readonly adminPassword: string
}

const refused = (detail: string, cause?: unknown): TestWorldError =>
    new TestWorldError({ code: TestWorldErrorCode.InfrastructureFailed, params: { detail }, cause })

/** The parsed realm export; a file that is not JSON is a world failure naming it. */
const readExport = (): unknown => {
    try {
        return JSON.parse(readFileSync(REALM_FILE, "utf8"))
    } catch (cause) {
        throw refused(`${REALM_FILE} is not a readable realm export`, cause)
    }
}

/** The realm and the api client of the realm export. */
export const readRealm = (): KeycloakRealm => {
    const exported = readExport()
    const client = isRecord(exported) && Array.isArray(exported.clients) ? exported.clients.find(isRecord) : undefined
    if (!isRecord(exported) || typeof exported.realm !== "string" || typeof client?.clientId !== "string")
        throw refused(`${REALM_FILE} names no realm and no client`)
    return { realm: exported.realm, clientId: client.clientId }
}

/** The token endpoint of a realm of the server at `baseUrl`. */
export const tokenUrlOf = (baseUrl: string, realm: string): string =>
    `${baseUrl}/realms/${realm}/protocol/openid-connect/token`

/** True once the realm answers its discovery document; false while the server boots or imports. */
export const realmAnswers = async (baseUrl: string, realm: string): Promise<boolean> => {
    const http = createE2EHttpClient({ baseUrl, timeoutMs: ADMIN_TIMEOUT_MS })
    return (await http.get(`/realms/${realm}/.well-known/openid-configuration`)).status === HTTP_OK
}

/** An access token of the bootstrap administrator, from the master realm. */
const adminToken = async (endpoint: KeycloakEndpoint): Promise<string> => {
    const http = createE2EHttpClient({ baseUrl: endpoint.baseUrl, timeoutMs: ADMIN_TIMEOUT_MS })
    const form = new URLSearchParams({
        grant_type: "password",
        client_id: "admin-cli",
        username: KEYCLOAK_ADMIN_USER,
        password: endpoint.adminPassword,
    })
    const answer = await http.post<unknown>(tokenUrlOf("", "master"), form)
    if (answer.status !== HTTP_OK || !isRecord(answer.body) || typeof answer.body.access_token !== "string")
        throw refused(`the Keycloak administrator could not sign in (${answer.status})`)
    return answer.body.access_token
}

/**
 * Registers a person in the realm (enabled, email verified, a permanent password, a complete profile so the password grant
 * is not held back by a required action) and answers the person id: the Keycloak user id, the `sub` of the tokens the
 * realm issues.
 */
export const registerPerson = async (endpoint: KeycloakEndpoint, email: string, password: string): Promise<string> => {
    const http = createE2EHttpClient({
        baseUrl: `${endpoint.baseUrl}/admin/realms/${endpoint.realm}`,
        bearerToken: await adminToken(endpoint),
        timeoutMs: ADMIN_TIMEOUT_MS,
    })
    const created = await http.post("/users", {
        username: email,
        email,
        firstName: "E2E",
        lastName: "Person",
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [{ type: "password", value: password, temporary: false }],
    })
    if (created.status !== HTTP_CREATED) throw refused(`Keycloak refused to register ${email} (${created.status})`)
    const found = await http.get<unknown>(`/users?username=${encodeURIComponent(email)}&exact=true`)
    const person = Array.isArray(found.body) ? found.body.find(isRecord) : undefined
    if (typeof person?.id !== "string") throw refused(`Keycloak does not list the person ${email} it registered`)
    return person.id
}
