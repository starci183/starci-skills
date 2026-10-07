/**
 * The run setup, shared by the jest globalSetup and the tests of the library. A run has N data slots (N = the run's jest
 * workers, capped by the declaration's `workers`, default {@link DEFAULT_WORKERS}); a slot is a complete, independent set of
 * everything below, named from its own namespace (`<ns>_w<k>`) and run token (`<run>-w<k>`), so the spec files of different
 * slots run at the same time without touching each other's data. The slots are provisioned one after another. Per slot:
 *  1. validate the declaration and read the stack definition (`.starcistacks/<env>`: service list and image versions);
 *  2. start the network-edge fakes of every SaaS (one control server) in this process;
 *  3. attach to the shared warm stack, or start it: postgres, redis, minio, qdrant, kafka, keycloak behind toxiproxy, the
 *     k3d cluster with its registry, with this repository's databases, realm, redis db, bucket/collection/topic prefixes and
 *     namespace prefix provisioned;
 *  4. start the sibling services (our own images from other repositories);
 *  5. run the migrate step (the cli migrate command's runner) once against the run's databases, then the seed files, and remember which tables the migrate/seed step filled
 *     (the per-spec reset keeps them);
 * Then the coordinates of every slot are published to the spec processes through the state file (protocol 2).
 * A failure removes whatever was started before it is rethrown (every slot already made, and the failing slot's parts): jest
 * does not call the teardown after a failed setup.
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
import { writeRunState } from "./context"
import type { RunContext } from "./context"

/** The slot count when the declaration names no `workers` cap: each slot holds a share of the real stack, so it stays small. */
export const DEFAULT_WORKERS = 2

/** What the teardown needs of one slot. */
export interface SlotHandles {
    readonly context: RunContext
    readonly fakes: FakesHost
    readonly siblings: ReadonlyArray<StartedSibling>
}

/** What the teardown needs from the setup: kept in the parent process, because jest runs both there. */
export interface SetupHandles {
    readonly runId: string
    readonly slots: ReadonlyArray<SlotHandles>
    readonly config: AnyTestWorldConfig
}

/** The number of slots of a run: one per jest worker, at most the declaration's `workers` (default {@link DEFAULT_WORKERS}). */
export const slotCountOf = (config: AnyTestWorldConfig, maxWorkers: number | undefined): number =>
    Math.max(1, Math.min(maxWorkers ?? 1, config.workers ?? DEFAULT_WORKERS))

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
            const qualified = `"${schema.replaceAll('"', '""')}"."${table.replaceAll('"', '""')}"`
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
        } else throw worldError(TestWorldErrorCode.ConfigInvalid, "migrate.module must be a module that exports bootstrap, a bootstrap function, or an AppModule with register")
    } catch (cause) {
        if (cause instanceof Error && cause.name === "TestWorldError") throw cause
        throw worldError(TestWorldErrorCode.MigrateFailed, `the migrate step failed: ${cause instanceof Error ? cause.message : String(cause)}`, cause)
    }
}

/**
 * A seed with every user id the realm file pins replaced by the id this slot's realm stores it under, so a seeded row that
 * names a Keycloak user (the token `sub`) matches the slot's realm. Ids are UUIDs, so a plain text replacement is exact.
 */
export const withRealmUserIds = (sql: string, context: Pick<RunContext, "infra">): string =>
    Object.entries(context.infra.keycloak?.userIds ?? {}).reduce((text, [pinned, stored]) => text.split(pinned).join(stored), sql)

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
            await withClient(database.url, (client) => client.query(withRealmUserIds(readFileSync(file, "utf8"), context)))
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
        ...(postgres === null ? {} : { postgresql: { connections: postgres.connections.map((c) => ({ name: c.name, extensions: c.extensions, database: c.database, schema: c.schema })) } }),
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

interface SlotPlan {
    readonly config: AnyTestWorldConfig
    readonly root: string
    readonly images: ReturnType<typeof resolveInfraImages>
    readonly siblingImages: ReturnType<typeof resolveSiblingImages>
    readonly runId: string
    readonly secretSeed: string
}

/** Disposes one slot: its fakes host, siblings, stack attachment and run directory; answers the failures it met. */
export const disposeSlot = async (slot: SlotHandles): Promise<ReadonlyArray<unknown>> => {
    const failures: Array<unknown> = []
    const attempt = async (work: () => unknown): Promise<void> => {
        try {
            await work()
        } catch (cause) {
            failures.push(cause)
        }
    }
    const { context } = slot
    await attempt(() => slot.fakes.close())
    await attempt(() => removeSiblings(slot.siblings))
    await attempt(async () => {
        const { stack } = require("../stack") as typeof import("../stack")
        await stack.detach({ namespace: context.namespace, runId: context.runId, infra: context.infra })
    })
    await attempt(() => {
        for (const directory of Object.values(context.directories)) rmSync(directory, { recursive: true, force: true })
    })
    return failures
}

/** Provisions one slot: its fakes, its stack attachment, its siblings, migrate and seeds, and the tables the reset keeps. */
const setupSlot = async (plan: SlotPlan, slot: number): Promise<SlotHandles> => {
    const { config, root } = plan
    const namespace = namespaceOf(root, slot)
    const runId = `${plan.runId}-w${slot}`
    const runDirectory = mkdtempSync(join(tmpdir(), `starci-tw-${runId}-`))
    mkdirSync(runDirectory, { recursive: true })
    const fakes = new FakesHost(config.fakes ?? {}, { runId, secret: (label) => secretOf(plan.secretSeed, label), now: () => new Date() })
    const { stack } = require("../stack") as typeof import("../stack")
    let infra: RunInfra | null = null
    let siblings: ReadonlyArray<StartedSibling> = []
    try {
        const started = await fakes.start()
        infra = await stack.attach(attachRequest(config, root, namespace, runId, plan.images))
        const base: RunContext = {
            slot,
            runId,
            namespace,
            secretSeed: plan.secretSeed,
            infra,
            fakes: { controlUrl: started.controlUrl, entries: started.fakes },
            services: {},
            directories: { [RUN_DIRECTORY]: runDirectory },
            keepTables: {},
            root,
        }
        siblings = await startSiblings(config.services ?? {}, plan.siblingImages, base)
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
        return { context: { ...withServices, keepTables }, fakes, siblings }
    } catch (cause) {
        await removeSiblings(siblings)
        await fakes.close().catch(() => undefined)
        if (infra !== null) await stack.detach({ namespace, runId, infra }).catch(() => undefined)
        rmSync(runDirectory, { recursive: true, force: true })
        throw cause
    }
}

/**
 * Starts the run and publishes its coordinates. `rootDirectory` is the jest project's rootDir (the be side of an app);
 * `maxWorkers` is the run's jest worker count (the globalConfig's), which sizes the slots with the declaration's cap.
 */
export const setupWorld = async (config: AnyTestWorldConfig, rootDirectory: string, maxWorkers?: number): Promise<SetupHandles> => {
    const root = resolve(config.root ?? appRootOf(rootDirectory))
    const selected: ReadonlyArray<InfraName> = validateDeclaration(config, root)
    const definition = readStackDefinition(root, config.stack)
    const plan: SlotPlan = {
        config,
        root,
        images: resolveInfraImages(config.stacks, definition, config.stack).filter((image) => selected.includes(image.service)),
        siblingImages: resolveSiblingImages(config.services ?? {}, definition, config.stack),
        runId: runToken(4),
        secretSeed: randomBytes(24).toString("hex"),
    }
    const slots: Array<SlotHandles> = []
    try {
        for (let slot = 1; slot <= slotCountOf(config, maxWorkers); slot += 1) slots.push(await setupSlot(plan, slot))
        writeRunState(plan.runId, slots.map((entry) => entry.context))
        return { runId: plan.runId, slots, config }
    } catch (cause) {
        for (const made of slots) await disposeSlot(made)
        throw cause
    }
}
