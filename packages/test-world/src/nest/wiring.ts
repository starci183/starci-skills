import { createHmac } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import type { RunContext } from "../jest/context"
import type {
    WiredApp,
    WiredCluster,
    WiredDatabase,
    WiredFake,
    WiredKafka,
    WiredKeycloak,
    WiredMinio,
    WiredQdrant,
    WiredRedis,
    WiredService,
    WorldWiring,
} from "../config/wiring"

/** How the wiring is built: the apps' reserved ports and the host the URLs name. */
export interface WiringOptions {
    /** The reserved port of each app of the world (empty during the globalSetup). */
    readonly appPorts?: Readonly<Record<string, number>>
    /** The host the URLs of infrastructure, fakes and apps name: `127.0.0.1` for the host process, `host.docker.internal` for a container. */
    readonly host?: string
}

/** The name of the directory inside the run directory a `directory(name)` call maps to; the run directory itself is `directories.run`. */
export const RUN_DIRECTORY = "run"

const notDeclared = (what: string) => worldError(TestWorldErrorCode.NotDeclared, `${what} is not declared in test-world.config.ts (stacks / fakes / services / apps)`)

/** Derives a run-stable secret: the same label gives the same value in the globalSetup and in every worker. */
export const secretOf = (seed: string, label: string): string => createHmac("sha256", seed).update(label).digest("base64url").slice(0, 32)

const swapHost = (host: string, wanted: string): string => (host === "127.0.0.1" ? wanted : host)

/** Builds the {@link WorldWiring} of a run from its context; a service the declaration does not run throws `NotDeclared` when read. */
export const buildWiring = (context: RunContext, options: WiringOptions = {}): WorldWiring => {
    const host = options.host ?? "127.0.0.1"
    const { infra } = context
    const wiring: Record<string, unknown> = {
        runId: context.runId,
        namespace: context.namespace.snake,
        directory: (name: string): string => {
            const base = context.directories[RUN_DIRECTORY]
            if (base === undefined) throw worldError(TestWorldErrorCode.StateMissing, "the run directory is missing from the state file")
            const path = join(base, name)
            mkdirSync(path, { recursive: true })
            return path
        },
        secret: (label: string): string => secretOf(context.secretSeed, label),
    }

    const apps: Record<string, WiredApp> = {}
    for (const [name, port] of Object.entries(options.appPorts ?? {})) apps[name] = { port, url: `http://${host}:${port}` }
    wiring["apps"] = apps

    const db: Record<string, WiredDatabase> = {}
    if (infra.postgresql !== undefined) {
        const { postgresql } = infra
        for (const [connection, database] of Object.entries(postgresql.databases)) {
            const login = postgresql.schemas[connection]
            const user = login?.user ?? postgresql.user
            const password = login?.password ?? postgresql.password
            db[connection] = {
                host: swapHost(postgresql.host, host),
                port: postgresql.port,
                user,
                password,
                database,
                schema: login?.schema ?? "public",
                url: `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${swapHost(postgresql.host, host)}:${postgresql.port}/${database}`,
            }
        }
    }
    wiring["db"] = db

    const lazy = (key: string, label: string, value: unknown): void => {
        if (value === undefined) {
            Object.defineProperty(wiring, key, {
                enumerable: true,
                get: () => {
                    throw notDeclared(label)
                },
            })
        } else wiring[key] = value
    }

    lazy(
        "redis",
        "redis",
        infra.redis === undefined
            ? undefined
            : ({
                  host: swapHost(infra.redis.host, host),
                  port: infra.redis.port,
                  db: infra.redis.db,
                  url: `redis://${swapHost(infra.redis.host, host)}:${infra.redis.port}/${infra.redis.db}`,
              } satisfies WiredRedis),
    )
    lazy(
        "minio",
        "minio",
        infra.minio === undefined
            ? undefined
            : ({
                  host: swapHost(infra.minio.host, host),
                  port: infra.minio.port,
                  endpoint: `http://${swapHost(infra.minio.host, host)}:${infra.minio.port}`,
                  accessKey: infra.minio.accessKey,
                  secretKey: infra.minio.secretKey,
                  bucketPrefix: infra.minio.bucketPrefix,
                  bucket: (name: string): string => infra.minio?.buckets[name] ?? `${infra.minio?.bucketPrefix ?? ""}${name}`,
              } satisfies WiredMinio),
    )
    lazy(
        "qdrant",
        "qdrant",
        infra.qdrant === undefined
            ? undefined
            : ({
                  host: swapHost(infra.qdrant.host, host),
                  port: infra.qdrant.port,
                  url: `http://${swapHost(infra.qdrant.host, host)}:${infra.qdrant.port}`,
                  collectionPrefix: infra.qdrant.collectionPrefix,
                  collection: (name: string): string => `${infra.qdrant?.collectionPrefix ?? ""}${name}`,
              } satisfies WiredQdrant),
    )
    lazy(
        "kafka",
        "kafka",
        infra.kafka === undefined
            ? undefined
            : ({
                  brokers: [`${swapHost(infra.kafka.host, host)}:${infra.kafka.port}`],
                  topicPrefix: infra.kafka.topicPrefix,
                  groupPrefix: infra.kafka.groupPrefix,
                  group: (name: string): string => `${infra.kafka?.groupPrefix ?? ""}${name}`,
                  clientId: (name: string): string => `${infra.kafka?.groupPrefix ?? ""}${name}`,
                  topic: (name: string): string => infra.kafka?.topics[name] ?? `${infra.kafka?.topicPrefix ?? ""}${name}`,
              } satisfies WiredKafka),
    )
    if (infra.keycloak === undefined) lazy("keycloak", "keycloak", undefined)
    else {
        const baseUrl = `http://${swapHost(infra.keycloak.host, host)}:${infra.keycloak.port}`
        const issuer = `${baseUrl}/realms/${infra.keycloak.realm}`
        const keycloak: WiredKeycloak = {
            baseUrl,
            realm: infra.keycloak.realm,
            issuer,
            tokenUrl: `${issuer}/protocol/openid-connect/token`,
            jwksUrl: `${issuer}/protocol/openid-connect/certs`,
            clientId: infra.keycloak.clientId,
            clientSecret: (client: string): string => {
                const secret = infra.keycloak?.clientSecrets?.[client]
                if (secret === undefined) throw worldError(TestWorldErrorCode.NotDeclared, `the realm ${infra.keycloak?.realm ?? ""} has no confidential client ${client}; declare it in the realm file (publicClient false)`)
                return secret
            },
        }
        wiring["keycloak"] = keycloak
    }

    const fake: Record<string, WiredFake> = {}
    for (const [name, entry] of Object.entries(context.fakes.entries)) {
        fake[name] = { ...entry, host: swapHost(entry.host, host), url: entry.url.replace("127.0.0.1", host), endpoints: swapEndpoints(entry.endpoints, host) }
    }
    wiring["fake"] = fake

    const services: Record<string, WiredService> = {}
    for (const [name, service] of Object.entries(context.services)) services[name] = { url: service.url, host: service.host, port: service.port }
    wiring["services"] = services

    lazy(
        "cluster",
        "k3d (set k3d.enable)",
        infra.cluster === undefined
            ? undefined
            : ({ namespacePrefix: infra.cluster.namespacePrefix, registry: infra.cluster.registry, images: infra.cluster.images } satisfies WiredCluster),
    )
    return wiring as unknown as WorldWiring
}

const swapEndpoints = (endpoints: Readonly<Record<string, string>>, host: string): Record<string, string> =>
    Object.fromEntries(Object.entries(endpoints).map(([key, value]) => [key, value.replace("127.0.0.1", host)]))
