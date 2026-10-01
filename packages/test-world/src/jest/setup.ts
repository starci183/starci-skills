/**
 * The run setup, shared by the jest globalSetup and the tests of the library. In order:
 *  1. validate the declaration and read the stack definition (`.starcistacks/<env>`: service list and image versions);
 *  2. start the network-edge fakes of every SaaS (one control server) in this process;
 *  3. attach to the shared warm stack, or start it: postgres, redis, minio, qdrant, kafka, keycloak behind toxiproxy, the
 *     k3d cluster with its registry, with this repository's databases, realm, redis db, bucket/collection/topic prefixes and
 *     namespace prefix provisioned;
 *  4. start the sibling services (our own images from other repositories);
 *  5. run `apps/migrate` once against the run's databases, then the seed files, and remember which tables the migrate/seed step filled
 *     (the per-spec reset keeps them);
 *  6. publish the coordinates to the spec workers through the state file.
 * A failure removes whatever was started before it is rethrown: jest does not call the teardown after a failed setup.
 */
import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { NestFactory } from "@nestjs/core"
import { Client } from "pg"
import { readStackDefinition, resolveInfraImages, resolveSiblingImages } from "../config/stack-file"
import type { AnyTestWorldConfig, InfraName, PostgresStack } from "../config/types"
import { validateDeclaration } from "../config/validate"
import { TestWorldErrorCode, worldError } from "../errors"
import { FakesHost } from "../fakes/framework/host"
import { buildWiring, RUN_DIRECTORY, secretOf } from "../nest/wiring"
import type { AttachRequest, Namespace, RunInfra } from "../stack/contracts"
import { namespaceOf, runToken } from "../stack/namespace"
import { removeSiblings, startSiblings } from "./siblings"
import type { StartedSibling } from "./siblings"
import { writeRunContext } from "./context"
import type { RunContext } from "./context"

/** What the teardown needs from the setup: kept in the parent process, because jest runs both there. */
export interface SetupHandles {
    readonly context: RunContext
    readonly fakes: FakesHost
    readonly siblings: ReadonlyArray<StartedSibling>
    readonly config: AnyTestWorldConfig
}

const MIGRATION_TABLE = /migrations|typeorm_metadata/i

const postgresOf = (config: AnyTestWorldConfig): PostgresStack | null => {
    const entry = config.stacks.postgresql
    return entry !== undefined && typeof entry === "object" && entry !== null && "connections" in entry ? (entry as PostgresStack) : null
}

const objectOf = <T>(entry: unknown): T | null => (typeof entry === "object" && entry !== null && !("fakedBy" in entry) ? (entry as T) : null)

const withClient = async <T>(url: string, work: (client: Client) => Promise<T>): Promise<T> => {
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
        return await work(client)
    } finally {
        await client.end()
    }
}

/** Every user table with at least one row: what the migrate/seed step filled, and the reset therefore keeps. */
const filledTables = (url: string): Promise<ReadonlyArray<string>> =>
    withClient(url, async (client) => {
        const tables = await client.query<{ table_schema: string; table_name: string }>(
            "SELECT table_schema, table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')",
        )
        const filled: Array<string> = []
        for (const { table_schema: schema, table_name: table } of tables.rows) {
            if (MIGRATION_TABLE.test(table)) continue
            const qualified = `"${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"`
            const probe = await client.query<{ present: boolean }>(`SELECT EXISTS (SELECT 1 FROM ${qualified}) AS present`)
            if (probe.rows[0]?.present === true) filled.push(schema === "public" ? table : `${schema}.${table}`)
        }
        return filled
    })

const runMigrate = async (config: AnyTestWorldConfig, context: RunContext): Promise<void> => {
    const wiring = buildWiring(context)
    const options = config.migrate.options(wiring) as never
    const entry = config.migrate.module as unknown
    try {
        if (typeof entry === "function") await (entry as (o: never) => Promise<unknown>)(options)
        else if (typeof entry === "object" && entry !== null && "bootstrap" in entry) await (entry as { bootstrap: (o: never) => Promise<unknown> }).bootstrap(options)
        else if (typeof entry === "object" && entry !== null && "register" in entry) {
            const app = await NestFactory.createApplicationContext((entry as { register: (o: never) => never }).register(options), { logger: ["error"] })
            await app.close()
        } else throw worldError(TestWorldErrorCode.ConfigInvalid, "migrate.module must be the apps/migrate module (exports bootstrap), a bootstrap function, or an AppModule with register")
    } catch (cause) {
        if (cause instanceof Error && cause.name === "TestWorldError") throw cause
        throw worldError(TestWorldErrorCode.MigrateFailed, `apps/migrate failed: ${cause instanceof Error ? cause.message : String(cause)}`, cause)
    }
}

const applySeeds = async (config: AnyTestWorldConfig, context: RunContext, root: string): Promise<void> => {
    const postgres = postgresOf(config)
    if (postgres === null) return
    const wiring = buildWiring(context)
    for (const connection of postgres.connections) {
        const database = wiring.db[connection.name]
        if (database === undefined) continue
        for (const seed of connection.seeds ?? []) {
            const file = resolve(root, seed)
            if (!existsSync(file)) throw worldError(TestWorldErrorCode.ConfigInvalid, `seed file ${seed} of connection ${connection.name} does not exist`)
            await withClient(database.url, (client) => client.query(readFileSync(file, "utf8")))
        }
    }
}

const attachRequest = (config: AnyTestWorldConfig, root: string, namespace: Namespace, runId: string, images: ReturnType<typeof resolveInfraImages>): AttachRequest => {
    const postgres = postgresOf(config)
    const keycloak = objectOf<{ realm: string; clientId?: string }>(config.stacks.keycloak)
    const minio = objectOf<{ buckets?: ReadonlyArray<string> }>(config.stacks.minio)
    const kafka = objectOf<{ topics?: ReadonlyArray<string> }>(config.stacks.kafka)
    return {
        namespace,
        runId,
        services: images,
        ...(postgres === null ? {} : { postgresql: { connections: postgres.connections.map((c) => ({ name: c.name, extensions: c.extensions })) } }),
        ...(keycloak === null ? {} : { keycloak: { realmFile: resolve(root, keycloak.realm), clientId: keycloak.clientId } }),
        ...(minio === null ? {} : { minio: { buckets: minio.buckets ?? [] } }),
        ...(kafka === null ? {} : { kafka: { topics: kafka.topics ?? [] } }),
        ...(config.k3d?.enable === true
            ? { k3d: { images: Object.entries(config.k3d.images ?? {}).map(([name, dockerfile]) => ({ name, dockerfile })) } }
            : {}),
    }
}

/**
 * The app root of a jest project: the directory that holds the app's hfs.json, `projectDirectory` itself or the app whose side
 * folder (be/) it is. Every path a declaration names (`stack`, seeds, the realm, Dockerfiles) is relative to it, because
 * `.starcistacks` and the one package.json live at the app root, beside be/ and fe/. A directory with no hfs.json at either
 * place is its own root.
 */
export const appRootOf = (projectDirectory: string): string => {
    const own = resolve(projectDirectory)
    if (existsSync(join(own, "hfs.json"))) return own
    const parent = dirname(own)
    return existsSync(join(parent, "hfs.json")) ? parent : own
}

/** Starts the run and publishes its coordinates. `rootDirectory` is the jest project's rootDir (the be side of an app). */
export const setupWorld = async (config: AnyTestWorldConfig, rootDirectory: string): Promise<SetupHandles> => {
    const root = resolve(config.root ?? appRootOf(rootDirectory))
    const selected: ReadonlyArray<InfraName> = validateDeclaration(config, root)
    const definition = readStackDefinition(root, config.stack)
    const images = resolveInfraImages(config.stacks, definition, config.stack).filter((image) => selected.includes(image.service))
    const siblingImages = resolveSiblingImages(config.services ?? {}, definition, config.stack)
    const namespace = namespaceOf(root)
    const runId = runToken(4)
    const secretSeed = randomBytes(24).toString("hex")
    const runDirectory = mkdtempSync(join(tmpdir(), `starci-tw-${runId}-`))
    mkdirSync(runDirectory, { recursive: true })
    const fakes = new FakesHost(config.fakes ?? {}, { runId, secret: (label) => secretOf(secretSeed, label), now: () => new Date() })
    const { stack } = await import("../stack")
    let infra: RunInfra | null = null
    let siblings: ReadonlyArray<StartedSibling> = []
    try {
        const started = await fakes.start()
        infra = await stack.attach(attachRequest(config, root, namespace, runId, images))
        const base: RunContext = {
            version: 1,
            runId,
            namespace,
            secretSeed,
            infra,
            fakes: { controlUrl: started.controlUrl, entries: started.fakes },
            services: {},
            directories: { [RUN_DIRECTORY]: runDirectory },
            keepTables: {},
            root,
        }
        siblings = await startSiblings(config.services ?? {}, siblingImages, base)
        const withServices: RunContext = {
            ...base,
            services: Object.fromEntries(siblings.map((s) => [s.name, { url: s.url, host: "127.0.0.1", port: s.port, container: s.container }])),
        }
        await runMigrate(config, withServices)
        await applySeeds(config, withServices, root)
        const keepTables: Record<string, ReadonlyArray<string>> = {}
        const wiring = buildWiring(withServices)
        for (const connection of postgresOf(config)?.connections ?? []) {
            const database = wiring.db[connection.name]
            if (database === undefined) continue
            keepTables[connection.name] = [...new Set([...(connection.keep ?? []), ...(await filledTables(database.url))])]
        }
        const context: RunContext = { ...withServices, keepTables }
        writeRunContext(context)
        return { context, fakes, siblings, config }
    } catch (cause) {
        await removeSiblings(siblings)
        await fakes.close().catch(() => undefined)
        if (infra !== null) await stack.detach({ namespace, runId, infra }).catch(() => undefined)
        rmSync(runDirectory, { recursive: true, force: true })
        throw cause
    }
}
