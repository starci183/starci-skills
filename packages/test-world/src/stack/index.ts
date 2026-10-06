/**
 * Layer (a), the stack core: the shared warm docker stack. One container per (service, image) for ALL repositories on the
 * machine (`starci-ts-<service>-<sha256(image)[0..8]>`), all on the `starci-test-net` network with a docker-assigned host port,
 * one toxiproxy in front of every service, and machine state (secrets, leases, redis DB and proxy port leases) in a registry
 * file under `~/.starci/test-stack` guarded by cross-process locks.
 */
import { homedir } from "node:os"
import { join } from "node:path"
import { INFRA_SERVICES } from "../config/types"
import type { InfraName } from "../config/types"
import { TestWorldErrorCode, worldError } from "../errors"
import { ensureContainer } from "./containers"
import type { AttachRequest, ClusterApi, Namespace, ProxiedEndpoint, RunInfra, StackApi, StackContainerStatus, StackImageRequest, StackStatus } from "./contracts"
import { Docker } from "./docker"
import { realPause, waitUntil } from "./health"
import type { FetchLike, Pause } from "./health"
import {
    KAFKA_SLOT_LISTENERS,
    kafkaProxyName,
    LABEL_IMAGE,
    LABEL_SERVICE,
    LABEL_STACK,
    PROXY_PORT_FIRST,
    PROXY_PORT_LAST,
    STACK_NETWORK,
    TOXIPROXY_API_PORT,
    TOXIPROXY_IMAGE,
    TOXIPROXY_SERVICE,
    containerName,
    proxyNameOf,
    serviceContainerName,
} from "./naming"
import { kafkaAnswers } from "./kafka-probe"
import { slotListenerPort } from "./services/kafka"
import { realPgConnect } from "./pg"
import type { PgConnect } from "./pg"
import { Registry, leaseKafkaListener, leaseProxyPort, leaseRedisDb, processAlive, releaseKafkaListener, releaseRedisDb, secretsFor } from "./registry"
import type { IsAlive } from "./registry"
import { redisRoundTrip } from "./resp"
import type { RedisRoundTrip } from "./resp"
import { SERVICE_DEFINITIONS } from "./services"
import type { Secrets, ServiceNet, ServiceTarget } from "./services/definition"
import { ToxiproxyClient } from "./toxiproxy"

/** What {@link createStack} may be given; every field defaults to the real thing. */
export interface StackDependencies {
    /** The docker CLI (default: real). */
    readonly docker?: Docker
    /** The machine state directory (default: `$STARCI_TEST_STACK_HOME` or `<homedir>/.starci/test-stack`). */
    readonly home?: string
    /** The k3d layer; loaded lazily from `./cluster` when absent and a run needs it. */
    readonly cluster?: ClusterApi
    /** Sleeps between polls and lock retries. */
    readonly pause?: Pause
    /** HTTP for readiness checks, toxiproxy and admin APIs. */
    readonly fetch?: FetchLike
    /** Postgres client factory. */
    readonly pg?: PgConnect
    /** Redis command runner. */
    readonly redis?: RedisRoundTrip
    /** Process liveness for lease pruning and lock stale detection. */
    readonly isAlive?: IsAlive
    /** The pid recorded in leases and locks (default: this process). */
    readonly pid?: number
    /** How long a service may take to become ready (default 300000). */
    readonly readyTimeoutMs?: number
    /** Whether a Kafka listener answers ApiVersions at host:port (default: a real TCP probe). */
    readonly kafkaProbe?: (host: string, port: number) => Promise<boolean>
}

/** The default machine state directory. */
export const defaultStackHome = (): string => process.env.STARCI_TEST_STACK_HOME ?? join(homedir(), ".starci", "test-stack")

const HOST = "127.0.0.1"
const UP_LOCK_TIMEOUT_MS = 15 * 60_000

interface Ensured {
    readonly service: InfraName
    readonly image: string
    readonly container: string
    readonly directPort: number
    readonly secrets: Secrets
}

interface Toxiproxy {
    readonly container: string
    readonly apiUrl: string
}

interface ListedContainer {
    readonly name: string
    readonly state: string
    readonly service: string
    readonly image: string
}

const isInfraName = (value: string): value is InfraName => (INFRA_SERVICES as ReadonlyArray<string>).includes(value)

const loadCluster = async (): Promise<ClusterApi> => {
    const specifier = "./cluster"
    const loaded = (await import(specifier)) as { readonly clusterApi: ClusterApi }
    return loaded.clusterApi
}

/** Builds the stack layer over injectable dependencies. */
export const createStack = (dependencies: StackDependencies = {}): StackApi => {
    const docker = dependencies.docker ?? new Docker()
    const fetchImpl = dependencies.fetch ?? fetch
    const pause = dependencies.pause ?? realPause
    const pid = dependencies.pid ?? process.pid
    const readyTimeoutMs = dependencies.readyTimeoutMs ?? 300_000
    const kafkaProbe = dependencies.kafkaProbe ?? ((host: string, port: number) => kafkaAnswers(host, port))
    const net: ServiceNet = { docker, fetch: fetchImpl, pg: dependencies.pg ?? realPgConnect, redis: dependencies.redis ?? redisRoundTrip, pause }
    let registryInstance: Registry | null = null
    const registry = (): Registry => {
        registryInstance ??= new Registry({ dir: dependencies.home ?? defaultStackHome(), isAlive: dependencies.isAlive ?? processAlive, pause, pid })
        return registryInstance
    }
    const clusterApi = async (): Promise<ClusterApi> => dependencies.cluster ?? loadCluster()

    const targetOf = (container: string, image: string, port: number, secrets: Secrets): ServiceTarget => ({ container, image, host: HOST, port, secrets, net })
    const waitForPort = async (container: string, containerPort: number): Promise<number> => {
        let found: number | null = null
        await waitUntil(`the published port ${containerPort} of ${container}`, async () => {
            found = await docker.hostPort(container, containerPort)
            return found !== null
        }, { timeoutMs: 30_000, intervalMs: 200, pause })
        return found ?? 0
    }

    const ensureToxiproxy = async (): Promise<Toxiproxy> => {
        const name = containerName(TOXIPROXY_SERVICE, TOXIPROXY_IMAGE)
        await ensureContainer(docker, {
            name,
            image: TOXIPROXY_IMAGE,
            service: TOXIPROXY_SERVICE,
            publish: [`${HOST}::${TOXIPROXY_API_PORT}`, `${HOST}:${PROXY_PORT_FIRST}-${PROXY_PORT_LAST}:${PROXY_PORT_FIRST}-${PROXY_PORT_LAST}`],
            env: {},
            command: [],
        })
        const apiUrl = `http://${HOST}:${await waitForPort(name, TOXIPROXY_API_PORT)}`
        const client = new ToxiproxyClient(apiUrl, fetchImpl)
        await waitUntil(`toxiproxy (${name})`, async () => (await client.version()).length > 0, { timeoutMs: 60_000, intervalMs: 300, pause })
        return { container: name, apiUrl }
    }

    const startService = async (request: StackImageRequest, kafkaListenerPorts: ReadonlyArray<number> | null): Promise<Ensured> => {
        const definition = SERVICE_DEFINITIONS[request.service]
        const name = serviceContainerName(request.service, request.image)
        const secrets = { ...(await registry().update((data) => secretsFor(data, name, () => definition.newSecrets()))) }
        const spec = definition.spec(request.image, secrets, { kafkaListenerPorts })
        await ensureContainer(docker, { name, image: request.image, service: request.service, publish: [`${HOST}::${definition.port}`], env: spec.env, command: spec.command })
        const directPort = await waitForPort(name, definition.port)
        const target = targetOf(name, request.image, directPort, secrets)
        await waitUntil(`${request.service} (${name})`, () => definition.ready(target), { timeoutMs: readyTimeoutMs, intervalMs: 500, pause })
        return { service: request.service, image: request.image, container: name, directPort, secrets }
    }

    /**
     * Under the `up` lock: network, toxiproxy, every requested container running and ready, and for Kafka one proxy per slot
     * listener (owned by the broker container, so they live as long as it does). Concurrent callers wait, then find everything warm.
     */
    const ensureStack = async (services: ReadonlyArray<StackImageRequest>): Promise<{ readonly toxiproxy: Toxiproxy; readonly ensured: ReadonlyArray<Ensured> }> =>
        registry().lock(
            "up",
            async () => {
                await docker.ensureNetwork(STACK_NETWORK)
                const toxiproxy = await ensureToxiproxy()
                const kafka = services.find((request) => request.service === "kafka")
                const listeners = Array.from({ length: KAFKA_SLOT_LISTENERS }, (_, index) => index + 1)
                let listenerPorts: ReadonlyArray<number> | null = null
                if (kafka !== undefined) {
                    const container = serviceContainerName("kafka", kafka.image)
                    listenerPorts = await registry().update((data) => listeners.map((listener) => leaseProxyPort(data, kafkaProxyName(kafka.image, listener), { runId: null, container })))
                }
                const ensured = await Promise.all(services.map((request) => startService(request, request.service === "kafka" ? listenerPorts : null)))
                if (kafka !== undefined && listenerPorts !== null) {
                    const client = new ToxiproxyClient(toxiproxy.apiUrl, fetchImpl)
                    const container = serviceContainerName("kafka", kafka.image)
                    const existing = await client.listProxies()
                    for (const listener of listeners) {
                        const name = kafkaProxyName(kafka.image, listener)
                        if (existing.some((proxy) => proxy.name === name)) continue
                        await client.createProxy({ name, listenPort: listenerPorts[listener - 1] ?? 0, upstream: `${container}:${slotListenerPort(listener)}` })
                    }
                }
                return { toxiproxy, ensured }
            },
            { timeoutMs: UP_LOCK_TIMEOUT_MS },
        )

    const listContainers = async (): Promise<ReadonlyArray<ListedContainer>> => {
        const listed = await docker.try(["ps", "-a", "--filter", `label=${LABEL_STACK}=1`, "--format", `{{.Names}}|{{.State}}|{{.Label "${LABEL_SERVICE}"}}|{{.Label "${LABEL_IMAGE}"}}`])
        if (listed.code !== 0) return []
        return listed.stdout
            .split(/\r?\n/)
            .filter((line) => line.trim() !== "")
            .map((line) => {
                const [name = "", state = "", service = "", ...image] = line.trim().split("|")
                return { name, state, service, image: image.join("|") }
            })
    }

    const statusOf = async (): Promise<StackStatus> => {
        const containers: Array<StackContainerStatus> = []
        for (const listed of await listContainers()) {
            const isToxiproxy = listed.service === TOXIPROXY_SERVICE
            if (!isToxiproxy && !isInfraName(listed.service)) continue
            const state: StackContainerStatus["state"] = listed.state === "running" ? "running" : ["exited", "created", "dead"].includes(listed.state) ? "exited" : "unhealthy"
            const containerPort = isInfraName(listed.service) ? SERVICE_DEFINITIONS[listed.service].port : TOXIPROXY_API_PORT
            containers.push({
                service: isInfraName(listed.service) ? listed.service : TOXIPROXY_SERVICE,
                image: listed.image,
                container: listed.name,
                state,
                port: state === "running" ? await docker.hostPort(listed.name, containerPort) : null,
            })
        }
        try {
            containers.push(...(await (await clusterApi()).status()))
        } catch {
            // no cluster layer, or docker without a cluster: nothing to add
        }
        return {
            home: dependencies.home ?? defaultStackHome(),
            containers,
            leases: registry().read().leases.map(({ namespace, runId, pid: leasePid, since }) => ({ namespace, runId, pid: leasePid, since })),
        }
    }

    /**
     * Tears down every run whose process died after provisioning (a crash, a killed jest): its databases, roles, realm, Redis DB,
     * buckets, topics, consumer groups, namespaces and proxies, through the same detach as a normal run. A failure is reported
     * on stderr and never blocks the caller's own run (the namespace of a reclaimed run is free either way).
     */
    const reclaimDead = async (): Promise<ReadonlyArray<string>> => {
        const reclaimed: Array<string> = []
        for (const lease of await registry().claimDead()) {
            if (lease.identity === undefined || lease.infra === undefined) continue
            try {
                await detachRun({ namespace: lease.identity, runId: lease.runId, infra: lease.infra })
            } catch (cause) {
                process.stderr.write(`@starci/test-world: reclaiming the crashed run ${lease.runId} (${lease.namespace}, pid ${lease.pid}) left a failure: ${cause instanceof Error ? cause.message : String(cause)}\n`)
            }
            reclaimed.push(lease.runId)
        }
        return reclaimed
    }

    /** Records what the run provisioned so far on its lease, so a crash after this point is reclaimed exactly. */
    const recordProvisioned = (namespace: Namespace, runId: string, infra: RunInfra): Promise<void> =>
        registry().update((data) => {
            data.leases = data.leases.map((lease) => (lease.runId === runId ? { ...lease, identity: namespace, infra: structuredClone(infra) } : lease))
        })

    const registerLease = async (namespace: Namespace, runId: string): Promise<void> => {
        await registry().update((data) => {
            const holder = data.leases.find((lease) => lease.namespace === namespace.snake && lease.runId !== runId)
            if (holder !== undefined) {
                throw worldError(TestWorldErrorCode.NamespaceBusy, `namespace ${namespace.snake} (${namespace.root}) is held by run ${holder.runId} of process ${holder.pid} since ${holder.since}; two runs of the same checkout cannot share the stack`)
            }
            if (!data.leases.some((lease) => lease.runId === runId)) data.leases.push({ namespace: namespace.snake, runId, pid, since: new Date().toISOString(), containers: [] })
        })
    }

    const withRunToxiproxy = (infra: RunInfra): ToxiproxyClient => new ToxiproxyClient(infra.toxiproxyApi, fetchImpl)

    const runsOf = (infra: RunInfra): ReadonlyArray<{ readonly service: InfraName; readonly run: ProxiedEndpoint }> =>
        INFRA_SERVICES.flatMap((service) => {
            const run = infra[service]
            return run === undefined ? [] : [{ service, run }]
        })

    const targetOfRun = (run: ProxiedEndpoint): ServiceTarget => targetOf(run.container, run.image, run.directPort, {})

    const detachRun = async (request: { readonly namespace: Namespace; readonly runId: string; readonly infra: RunInfra }): Promise<void> => {
        const { namespace, runId, infra } = request
        const errors: Array<unknown> = []
        const attempt = async (work: () => Promise<void>): Promise<void> => {
            try {
                await work()
            } catch (cause) {
                errors.push(cause)
            }
        }
        for (const { service, run } of runsOf(infra)) {
            await attempt(() =>
                SERVICE_DEFINITIONS[service].deprovision(targetOfRun(run), run, {
                    namespace,
                    releaseRedisDb: () => registry().update((data) => releaseRedisDb(data, namespace.snake)),
                }),
            )
            // A Kafka slot listener's proxy belongs to the broker and stays for the next lessee (its toxics are cleared when it is
            // leased again); every other proxy belongs to this run alone.
            if (service !== "kafka") await attempt(() => withRunToxiproxy(infra).deleteProxy(run.proxy))
        }
        if (infra.cluster !== undefined) await attempt(async () => (await clusterApi()).detach({ namespace, runId }))
        await registry().update((data) => {
            data.leases = data.leases.filter((lease) => lease.runId !== runId)
            for (const [name, lease] of Object.entries(data.proxyPorts)) if (lease.runId === runId) delete data.proxyPorts[name]
            releaseRedisDb(data, namespace.snake)
            releaseKafkaListener(data, namespace.snake)
            for (const key of Object.keys(data.notes)) if (key.includes(`:${namespace.kebab}-`)) delete data.notes[key]
        })
        const first = errors[0]
        if (first !== undefined) throw first instanceof Error ? first : worldError(TestWorldErrorCode.InfrastructureFailed, String(first as string))
    }

    return {
        async up(services, k3d) {
            await ensureStack(services)
            if (k3d !== undefined) await (await clusterApi()).up()
            return statusOf()
        },

        async down(options = {}) {
            const force = options.force === true
            await reclaimDead()
            await registry().lock(
                "up",
                async () => {
                    const data = registry().read()
                    const inUse = new Set(force ? [] : data.leases.flatMap((lease) => lease.containers))
                    const removed: Array<string> = []
                    let remaining = 0
                    for (const listed of await listContainers()) {
                        if (inUse.has(listed.name)) {
                            remaining += 1
                            continue
                        }
                        await docker.remove(listed.name)
                        removed.push(listed.name)
                    }
                    if (remaining === 0) await docker.try(["network", "rm", STACK_NETWORK])
                    await registry().update((fresh) => {
                        for (const [name, lease] of Object.entries(fresh.proxyPorts)) {
                            if (lease.container !== null && removed.includes(lease.container)) delete fresh.proxyPorts[name]
                            if (lease.runId !== null && removed.some((container) => container.startsWith(`starci-ts-${TOXIPROXY_SERVICE}-`))) delete fresh.proxyPorts[name]
                        }
                    })
                },
                { timeoutMs: UP_LOCK_TIMEOUT_MS },
            )
            if (force || registry().read().leases.length === 0) {
                let cluster: ClusterApi | null = null
                try {
                    cluster = await clusterApi()
                } catch {
                    cluster = null
                }
                if (cluster !== null) await cluster.down({ force })
            }
            return statusOf()
        },

        status: statusOf,

        async attach(request: AttachRequest): Promise<RunInfra> {
            const { namespace, runId } = request
            await reclaimDead()
            await registerLease(namespace, runId)
            // Built up as services are provisioned so a failure can detach exactly what exists; each entry is the RunX its definition returned.
            const partial: Record<string, unknown> = { toxiproxyApi: "" }
            const infraOf = (): RunInfra => partial as unknown as RunInfra
            try {
                const { toxiproxy, ensured } = await ensureStack(request.services)
                partial.toxiproxyApi = toxiproxy.apiUrl
                await registry().update((data) => {
                    const lease = data.leases.find((entry) => entry.runId === runId)
                    if (lease !== undefined) data.leases = data.leases.map((entry) => (entry.runId === runId ? { ...entry, containers: [toxiproxy.container, ...ensured.map((item) => item.container)] } : entry))
                })
                const client = new ToxiproxyClient(toxiproxy.apiUrl, fetchImpl)
                for (const item of ensured) {
                    const definition = SERVICE_DEFINITIONS[item.service]
                    const target = targetOf(item.container, item.image, item.directPort, item.secrets)
                    const provisioned = await definition.provision(target, {
                        namespace,
                        request,
                        leaseRedisDb: () => registry().update((data) => leaseRedisDb(data, namespace.snake)),
                        leaseKafkaListener: () => registry().update((data) => leaseKafkaListener(data, namespace.snake)),
                    })
                    let proxy: string
                    let port: number
                    if (item.service === "kafka") {
                        // The slot's own listener: its proxy is cleared of any toxic a previous lessee left, then probed end to end.
                        const listener = (provisioned.run as { readonly listener: number }).listener
                        proxy = kafkaProxyName(item.image, listener)
                        port = await registry().update((data) => leaseProxyPort(data, proxy, { runId: null, container: item.container }))
                        await client.resetToxics(proxy)
                        await client.setEnabled(proxy, true)
                        await waitUntil(`kafka listener ${listener} through ${HOST}:${port}`, () => kafkaProbe(HOST, port), { timeoutMs: 60_000, intervalMs: 500, pause })
                    } else {
                        proxy = proxyNameOf(runId, item.service)
                        port = await registry().update((data) => leaseProxyPort(data, proxy, { runId, container: null }))
                        await client.createProxy({ name: proxy, listenPort: port, upstream: `${item.container}:${definition.port}` })
                    }
                    const run: ProxiedEndpoint = { host: HOST, port, directPort: item.directPort, proxy, image: item.image, container: item.container, ...provisioned.run }
                    partial[item.service] = run
                    await recordProvisioned(namespace, runId, infraOf())
                    const notes = provisioned.notes
                    if (notes !== undefined) await registry().update((data) => { Object.assign(data.notes, notes) })
                }
                if (request.k3d !== undefined) {
                    const cluster = await clusterApi()
                    await cluster.up()
                    partial.cluster = await cluster.attach({ namespace, runId, root: namespace.root, images: request.k3d.images })
                    await recordProvisioned(namespace, runId, infraOf())
                }
                return infraOf()
            } catch (cause) {
                await detachRun({ namespace, runId, infra: infraOf() }).catch(() => undefined)
                throw cause
            }
        },

        detach: detachRun,

        async reset(request) {
            const { namespace, infra, keepTables } = request
            const notes = registry().read().notes
            for (const { service, run } of runsOf(infra)) await SERVICE_DEFINITIONS[service].reset(targetOfRun(run), run, { namespace, keepTables, notes })
            if (infra.cluster !== undefined) await (await clusterApi()).reset({ namespace })
        },
    }
}

/** The real stack: real docker, the real home, real clients. Nothing runs until a method is called. */
export const stack: StackApi = createStack()
