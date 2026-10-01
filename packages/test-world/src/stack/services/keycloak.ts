import { readFile } from "node:fs/promises"
import { TestWorldErrorCode, worldError } from "../../errors"
import type { RunKeycloak } from "../contracts"
import { baseUrl, randomSecret } from "./definition"
import type { ServiceDefinition, ServiceTarget } from "./definition"

const ADMIN_USER = "admin"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The note key under which the usernames seeded by the realm import are kept for `reset`. */
export const seedNoteKey = (realm: string): string => `keycloak-seed:${realm}`

/** What was read from a realm import file. */
export interface RealmFile {
    /** The realm name in the file. */
    readonly realm: string
    /** The file content with `realm` rewritten and the realm `id` dropped. */
    readonly body: Record<string, unknown>
    /** The first client that enables the password grant, when any. */
    readonly passwordClientId: string | null
    /** Lowercase usernames of the users the file seeds. */
    readonly seedUsers: ReadonlyArray<string>
}

/** Parses a realm export and re-targets it at `<namespace.kebab>-<realm>`. */
export const prepareRealm = (json: string, kebab: string, file: string): RealmFile & { readonly stored: string } => {
    const parsed: unknown = JSON.parse(json)
    if (!isRecord(parsed) || typeof parsed.realm !== "string" || parsed.realm === "") {
        throw worldError(TestWorldErrorCode.ConfigInvalid, `the keycloak realm file ${file} has no "realm" name`)
    }
    const stored = `${kebab}-${parsed.realm}`
    const { id: _dropped, ...rest } = parsed
    const clients = Array.isArray(parsed.clients) ? parsed.clients.filter(isRecord) : []
    const passwordClient = clients.find((client) => client.directAccessGrantsEnabled === true && typeof client.clientId === "string")
    const users = Array.isArray(parsed.users) ? parsed.users.filter(isRecord) : []
    return {
        realm: parsed.realm,
        stored,
        body: { ...rest, realm: stored },
        passwordClientId: typeof passwordClient?.clientId === "string" ? passwordClient.clientId : null,
        seedUsers: users.flatMap((user) => (typeof user.username === "string" ? [user.username.toLowerCase()] : [])),
    }
}

const adminToken = async (target: ServiceTarget, user: string, password: string): Promise<string> => {
    const response = await target.net.fetch(`${baseUrl(target)}/realms/master/protocol/openid-connect/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli", username: user, password }).toString(),
        signal: AbortSignal.timeout(15_000),
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok || !isRecord(body) || typeof body.access_token !== "string") {
        throw worldError(TestWorldErrorCode.InfrastructureFailed, `keycloak admin token answered ${response.status}`)
    }
    return body.access_token
}

const admin = async (target: ServiceTarget, token: string, method: string, path: string, body?: unknown): Promise<{ readonly status: number; readonly json: unknown }> => {
    const response = await target.net.fetch(`${baseUrl(target)}/admin${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
    })
    const text = await response.text()
    let json: unknown = null
    try {
        json = text === "" ? null : JSON.parse(text)
    } catch {
        json = text
    }
    return { status: response.status, json }
}

const deleteRealm = async (target: ServiceTarget, token: string, realm: string): Promise<void> => {
    const removed = await admin(target, token, "DELETE", `/realms/${encodeURIComponent(realm)}`)
    if (removed.status !== 204 && removed.status !== 404) throw worldError(TestWorldErrorCode.InfrastructureFailed, `keycloak delete realm ${realm} answered ${removed.status}`)
}

/** Keycloak: one shared `start-dev` server per image; a namespace owns one realm imported from the repository file as `<namespace.kebab>-<realm>`. */
export const keycloakService: ServiceDefinition<RunKeycloak> = {
    name: "keycloak",
    port: 8080,
    newSecrets: () => ({ adminUser: ADMIN_USER, adminPassword: randomSecret() }),
    spec: (_image, secrets) => ({
        env: {
            KC_BOOTSTRAP_ADMIN_USERNAME: secrets.adminUser ?? ADMIN_USER,
            KC_BOOTSTRAP_ADMIN_PASSWORD: secrets.adminPassword ?? "",
            KEYCLOAK_ADMIN: secrets.adminUser ?? ADMIN_USER,
            KEYCLOAK_ADMIN_PASSWORD: secrets.adminPassword ?? "",
            KC_HEALTH_ENABLED: "true",
            KC_HTTP_ENABLED: "true",
            KC_HOSTNAME_STRICT: "false",
        },
        command: ["start-dev"],
    }),
    // A real check: the master realm answers and the generated admin can sign in.
    ready: async (target) => {
        await adminToken(target, target.secrets.adminUser ?? ADMIN_USER, target.secrets.adminPassword ?? "")
        return true
    },
    provision: async (target, input) => {
        const config = input.request.keycloak
        if (config === undefined) throw worldError(TestWorldErrorCode.ConfigInvalid, "keycloak was requested without a realm file")
        const adminUser = target.secrets.adminUser ?? ADMIN_USER
        const adminPassword = target.secrets.adminPassword ?? ""
        const prepared = prepareRealm(await readFile(config.realmFile, "utf8"), input.namespace.kebab, config.realmFile)
        const clientId = config.clientId ?? prepared.passwordClientId
        if (clientId === null) {
            throw worldError(TestWorldErrorCode.ConfigInvalid, `no client of ${config.realmFile} enables directAccessGrantsEnabled; name the password-grant client with keycloak.clientId`)
        }
        const token = await adminToken(target, adminUser, adminPassword)
        await deleteRealm(target, token, prepared.stored)
        const imported = await admin(target, token, "POST", "/realms", prepared.body)
        if (imported.status !== 201) throw worldError(TestWorldErrorCode.InfrastructureFailed, `keycloak realm import answered ${imported.status}: ${JSON.stringify(imported.json).slice(0, 500)}`)
        return {
            run: { realm: prepared.stored, clientId, adminUser, adminPassword },
            notes: { [seedNoteKey(prepared.stored)]: JSON.stringify(prepared.seedUsers) },
        }
    },
    reset: async (target, run, input) => {
        const raw = input.notes[seedNoteKey(run.realm)]
        const seeded = new Set<string>(raw === undefined ? [] : (JSON.parse(raw) as Array<string>))
        const token = await adminToken(target, run.adminUser, run.adminPassword)
        const realm = encodeURIComponent(run.realm)
        const listed = await admin(target, token, "GET", `/realms/${realm}/users?max=10000`)
        if (listed.status !== 200 || !Array.isArray(listed.json)) throw worldError(TestWorldErrorCode.InfrastructureFailed, `keycloak list users answered ${listed.status}`)
        for (const user of listed.json) {
            if (!isRecord(user) || typeof user.id !== "string" || typeof user.username !== "string") continue
            if (seeded.has(user.username.toLowerCase())) continue
            const removed = await admin(target, token, "DELETE", `/realms/${realm}/users/${encodeURIComponent(user.id)}`)
            if (removed.status !== 204 && removed.status !== 404) throw worldError(TestWorldErrorCode.InfrastructureFailed, `keycloak delete user ${user.username} answered ${removed.status}`)
        }
        // Sessions of the users that stay (the seeded ones) go too; the sessions of deleted users went with them.
        await admin(target, token, "POST", `/realms/${realm}/logout-all`)
    },
    deprovision: async (target, run) => {
        await deleteRealm(target, await adminToken(target, run.adminUser, run.adminPassword), run.realm)
    },
}
