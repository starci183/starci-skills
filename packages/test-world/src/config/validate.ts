/** Validation of the declaration (`test-world.config.ts`): every problem is found and listed in one error. */
import { existsSync, readFileSync, statSync } from "node:fs"
import { isAbsolute, join } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import { isFakedService, isInfraName, selectedInfraServices } from "./stack-file"
import { INFRA_SERVICES, type InfraName, type KeycloakStack, type PostgresStack, type TestWorldConfig } from "./types"

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim() !== ""

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const resolvePath = (root: string, path: string): string => (isAbsolute(path) ? path : join(root, path))

const isFile = (path: string): boolean => existsSync(path) && statSync(path).isFile()

/**
 * Validates the declaration against the repository at `root`. Throws ConfigInvalid listing ALL problems; otherwise answers
 * the selected (non-faked) infrastructure services in canonical order.
 */
export const validateDeclaration = (config: TestWorldConfig, root: string): ReadonlyArray<InfraName> => {
    const problems: string[] = []
    const fakeNames = Object.keys(config.fakes ?? {})

    if (!isNonEmptyString(config.stack)) {
        problems.push("stack: the stack definition directory is required (for example `.starcistacks/dev`)")
    } else if (!existsSync(resolvePath(root, config.stack)) || !statSync(resolvePath(root, config.stack)).isDirectory()) {
        problems.push(`stack: the directory ${config.stack} does not exist under ${root}`)
    }

    if (config.workers !== undefined && (!Number.isInteger(config.workers) || config.workers < 1)) {
        problems.push(`workers: the most data slots of a run is a positive integer, got ${String(config.workers)}`)
    }

    const stacks = asRecord(config.stacks)
    if (stacks === undefined) problems.push("stacks: the block is required")
    for (const [key, entry] of Object.entries(stacks ?? {})) {
        if (entry === undefined) continue
        const faked = isFakedService(entry)
        if (!isInfraName(key) && !faked) {
            problems.push(
                `stacks.${key}: not an infrastructure service (${INFRA_SERVICES.join(", ")}); a service the world does not run must be faked: { fakedBy: "<fake name>", reason: "<why>" }`,
            )
            continue
        }
        if (!faked) continue
        const { fakedBy, reason } = entry
        if (!isNonEmptyString(fakedBy)) problems.push(`stacks.${key}.fakedBy: must name an entry of \`fakes\``)
        else if (!fakeNames.includes(fakedBy)) {
            problems.push(`stacks.${key}.fakedBy: "${fakedBy}" is not an entry of \`fakes\` (${fakeNames.length === 0 ? "no fakes declared" : fakeNames.join(", ")})`)
        }
        if (!isNonEmptyString(reason)) problems.push(`stacks.${key}.reason: a faked service needs the reason the real service cannot run here`)
    }

    const postgresql = stacks?.postgresql
    if (postgresql !== undefined && !isFakedService(postgresql)) {
        const connections = (postgresql as PostgresStack).connections
        if (!Array.isArray(connections) || connections.length === 0) {
            problems.push("stacks.postgresql.connections: at least one connection is required")
        } else {
            const seen = new Set<string>()
            for (const [index, connection] of connections.entries()) {
                const name: unknown = connection?.name
                if (!isNonEmptyString(name) || !IDENTIFIER.test(name)) {
                    problems.push(`stacks.postgresql.connections[${index}].name: "${String(name)}" must match ${IDENTIFIER.source}`)
                } else if (seen.has(name)) {
                    problems.push(`stacks.postgresql.connections[${index}].name: "${name}" is declared twice`)
                } else {
                    seen.add(name)
                }
                const database: unknown = connection?.database
                const schema: unknown = connection?.schema
                if (database !== undefined && (!isNonEmptyString(database) || !IDENTIFIER.test(database))) {
                    problems.push(`stacks.postgresql.connections[${index}].database: "${String(database)}" must match ${IDENTIFIER.source}`)
                }
                if (schema !== undefined && (!isNonEmptyString(schema) || !IDENTIFIER.test(schema) || schema === "public" || schema.startsWith("pg_"))) {
                    problems.push(`stacks.postgresql.connections[${index}].schema: "${String(schema)}" must match ${IDENTIFIER.source} and be neither public nor pg_*`)
                }
                for (const seed of connection?.seeds ?? []) {
                    if (!isFile(resolvePath(root, seed))) problems.push(`stacks.postgresql.connections[${index}].seeds: ${seed} does not exist under ${root}`)
                }
            }
            // Contexts that share one database each live in a schema of their own: two in one database without distinct schemas would share tables.
            const byDatabase = new Map<string, Array<{ readonly name: string; readonly schema: string | undefined }>>()
            for (const connection of connections) {
                const key = connection?.database ?? connection?.name
                if (!isNonEmptyString(key)) continue
                byDatabase.set(key, [...(byDatabase.get(key) ?? []), { name: String(connection.name), schema: connection.schema }])
            }
            for (const [database, members] of byDatabase) {
                if (members.length < 2) continue
                const unschemed = members.filter((member) => member.schema === undefined).map((member) => member.name)
                if (unschemed.length > 0) problems.push(`stacks.postgresql.connections: ${unschemed.join(", ")} share the database ${database} with other contexts and must each declare a schema`)
                const schemas = members.flatMap((member) => (member.schema === undefined ? [] : [member.schema]))
                const twice = schemas.filter((schema, at) => schemas.indexOf(schema) !== at)
                if (twice.length > 0) problems.push(`stacks.postgresql.connections: the schema ${[...new Set(twice)].join(", ")} is declared twice in the database ${database}`)
            }
        }
    }

    const keycloak = stacks?.keycloak
    if (keycloak !== undefined && !isFakedService(keycloak)) {
        const realm = (keycloak as KeycloakStack).realm
        if (!isNonEmptyString(realm)) {
            problems.push("stacks.keycloak.realm: the realm import file is required")
        } else if (!isFile(resolvePath(root, realm))) {
            problems.push(`stacks.keycloak.realm: ${realm} does not exist under ${root}`)
        } else {
            try {
                const parsed = asRecord(JSON.parse(readFileSync(resolvePath(root, realm), "utf8")))
                if (parsed === undefined || !isNonEmptyString(parsed.realm)) problems.push(`stacks.keycloak.realm: ${realm} has no \`realm\` name`)
            } catch (error) {
                problems.push(`stacks.keycloak.realm: ${realm} is not valid JSON (${error instanceof Error ? error.message : String(error)})`)
            }
        }
    }

    if (config.k3d?.enable === true) {
        for (const [name, dockerfile] of Object.entries(config.k3d.images ?? {})) {
            if (!isFile(resolvePath(root, dockerfile))) problems.push(`k3d.images.${name}: the Dockerfile ${dockerfile} does not exist under ${root}`)
        }
    }

    const appNames = Object.keys(config.apps ?? {})
    for (const name of appNames) {
        if (!IDENTIFIER.test(name)) problems.push(`apps.${name}: the app name must match ${IDENTIFIER.source}`)
    }
    if (config.identity !== undefined) {
        if (appNames.length === 0) problems.push("identity: declared but `apps` is empty; sign-in goes through an app of the world")
        if (config.identity.register === "keycloak") {
            const selected = stacks?.keycloak !== undefined && !isFakedService(stacks.keycloak)
            if (!selected) problems.push('identity.register: "keycloak" needs a real `stacks.keycloak` (not faked, not absent)')
        }
        if (typeof config.identity.signIn !== "function") problems.push("identity.signIn: a function is required")
    }

    const migrate: unknown = config.migrate
    if (migrate === undefined || migrate === null) {
        problems.push("migrate: the migrate block is required ({ module, options })")
    } else {
        const block = asRecord(migrate)
        if (block?.module === undefined) problems.push("migrate.module: the migrate entry is required")
        if (typeof block?.options !== "function") problems.push("migrate.options: a function building the options from the wiring is required")
    }

    if (problems.length > 0) {
        throw worldError(
            TestWorldErrorCode.ConfigInvalid,
            `the test world declaration is invalid (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n${problems.map((problem) => `  - ${problem}`).join("\n")}`,
        )
    }
    return selectedInfraServices(config.stacks)
}
