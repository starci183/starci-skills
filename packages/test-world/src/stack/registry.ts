import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import { realPause } from "./health"
import type { Pause } from "./health"
import type { StackLease } from "./contracts"
import { PROXY_PORT_FIRST, PROXY_PORT_LAST } from "./naming"

/** A lease as the registry stores it: the public {@link StackLease} plus the shared containers the run uses (what `down` keeps). */
export interface RegistryLease extends StackLease {
    readonly containers: ReadonlyArray<string>
}

/** A leased toxiproxy listen port. */
export interface ProxyPortLease {
    readonly port: number
    /** The run the proxy belongs to; null for a stack-wide proxy (Kafka). */
    readonly runId: string | null
    /** The container a stack-wide proxy belongs to; null for a per-run proxy. */
    readonly container: string | null
}

/** The content of the registry file. */
export interface RegistryData {
    readonly version: 1
    /** Generated secrets by container name. */
    secrets: Record<string, Record<string, string>>
    /** Live leases; a lease whose pid is dead is dropped on every read. */
    leases: Array<RegistryLease>
    /** Redis DB index by namespace (snake). */
    redisDbs: Record<string, number>
    /** Toxiproxy listen ports by proxy name. */
    proxyPorts: Record<string, ProxyPortLease>
    /** Free-form notes of provisioners (e.g. the users a Keycloak import seeded), by key. */
    notes: Record<string, string>
}

/** Whether a process is alive. */
export type IsAlive = (pid: number) => boolean

/** The real {@link IsAlive}: signal 0; a permission error still means the process exists. */
export const processAlive: IsAlive = (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
        process.kill(pid, 0)
        return true
    } catch (cause) {
        return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EPERM"
    }
}

/** What builds a {@link Registry}. */
export interface RegistryOptions {
    /** The home directory of the machine state. */
    readonly dir: string
    readonly isAlive?: IsAlive
    readonly pause?: Pause
    /** The pid recorded as a lock owner (default: this process). */
    readonly pid?: number
}

/** How a named lock waits. */
export interface LockOptions {
    /** Give up after this many milliseconds of waiting (default 30000). */
    readonly timeoutMs?: number
    readonly intervalMs?: number
}

const emptyData = (): RegistryData => ({ version: 1, secrets: {}, leases: [], redisDbs: {}, proxyPorts: {}, notes: {} })

const REDIS_DB_COUNT = 16
const ORPHAN_LOCK_MS = 5000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The machine-wide state of the stack: a JSON file under a cross-process, mkdir-based lock. */
export class Registry {
    private readonly dir: string
    private readonly isAlive: IsAlive
    private readonly pause: Pause
    private readonly pid: number

    constructor(options: RegistryOptions) {
        this.dir = options.dir
        this.isAlive = options.isAlive ?? processAlive
        this.pause = options.pause ?? realPause
        this.pid = options.pid ?? process.pid
        mkdirSync(this.dir, { recursive: true })
    }

    /** The registry with dead leases (and what hung off them) pruned; takes no lock. */
    read(): RegistryData {
        return this.prune(this.load())
    }

    /** Runs `mutate` on the pruned registry under the registry lock and persists the result. */
    async update<T>(mutate: (data: RegistryData) => T | Promise<T>): Promise<T> {
        return this.lock("registry", async () => {
            const data = this.prune(this.load())
            const result = await mutate(data)
            this.save(data)
            return result
        })
    }

    /** Runs `work` while holding the named cross-process lock (`<dir>/<name>.lock`); a dead or vanished owner is broken. */
    async lock<T>(name: string, work: () => Promise<T>, options: LockOptions = {}): Promise<T> {
        const lockDir = join(this.dir, `${name}.lock`)
        const interval = options.intervalMs ?? 50
        const attempts = Math.ceil((options.timeoutMs ?? 30_000) / interval)
        for (let attempt = 0; ; attempt += 1) {
            if (this.tryCreate(lockDir)) break
            this.breakIfStale(lockDir)
            if (attempt >= attempts) throw worldError(TestWorldErrorCode.TimedOut, `the ${name} lock at ${lockDir} stayed held by another process for ${options.timeoutMs ?? 30_000}ms`)
            await this.pause(interval)
        }
        try {
            return await work()
        } finally {
            rmSync(lockDir, { recursive: true, force: true })
        }
    }

    private tryCreate(lockDir: string): boolean {
        try {
            mkdirSync(lockDir)
        } catch (cause) {
            if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "EEXIST") return false
            throw cause
        }
        writeFileSync(join(lockDir, "owner"), JSON.stringify({ pid: this.pid }))
        return true
    }

    private breakIfStale(lockDir: string): void {
        let ownerPid: number | null = null
        try {
            const owner: unknown = JSON.parse(readFileSync(join(lockDir, "owner"), "utf8"))
            if (isRecord(owner) && typeof owner.pid === "number") ownerPid = owner.pid
        } catch {
            // owner not written yet, or unreadable
        }
        if (ownerPid !== null) {
            if (this.isAlive(ownerPid)) return
        } else {
            try {
                if (Date.now() - statSync(lockDir).mtimeMs < ORPHAN_LOCK_MS) return
            } catch {
                return
            }
        }
        // Rename first: only one breaker wins the atomic rename, the others see ENOENT and retry the mkdir.
        const graveyard = `${lockDir}.stale.${this.pid}.${Date.now()}`
        try {
            renameSync(lockDir, graveyard)
            rmSync(graveyard, { recursive: true, force: true })
        } catch {
            // someone else broke it first
        }
    }

    private load(): RegistryData {
        try {
            const parsed: unknown = JSON.parse(readFileSync(join(this.dir, "registry.json"), "utf8"))
            if (!isRecord(parsed)) return emptyData()
            const base = emptyData()
            return {
                version: 1,
                secrets: isRecord(parsed.secrets) ? (parsed.secrets as RegistryData["secrets"]) : base.secrets,
                leases: Array.isArray(parsed.leases) ? (parsed.leases as Array<RegistryLease>) : base.leases,
                redisDbs: isRecord(parsed.redisDbs) ? (parsed.redisDbs as RegistryData["redisDbs"]) : base.redisDbs,
                proxyPorts: isRecord(parsed.proxyPorts) ? (parsed.proxyPorts as RegistryData["proxyPorts"]) : base.proxyPorts,
                notes: isRecord(parsed.notes) ? (parsed.notes as RegistryData["notes"]) : base.notes,
            }
        } catch {
            return emptyData()
        }
    }

    private save(data: RegistryData): void {
        const target = join(this.dir, "registry.json")
        const temporary = `${target}.${this.pid}.tmp`
        writeFileSync(temporary, JSON.stringify(data, null, 2))
        renameSync(temporary, target)
    }

    private prune(data: RegistryData): RegistryData {
        data.leases = data.leases.filter((lease) => this.isAlive(lease.pid))
        const namespaces = new Set(data.leases.map((lease) => lease.namespace))
        const runs = new Set(data.leases.map((lease) => lease.runId))
        for (const namespace of Object.keys(data.redisDbs)) {
            if (!namespaces.has(namespace)) delete data.redisDbs[namespace]
        }
        for (const [name, lease] of Object.entries(data.proxyPorts)) {
            if (lease.runId !== null && !runs.has(lease.runId)) delete data.proxyPorts[name]
        }
        return data
    }
}

/** The secrets of a container, generating and storing them on first use. */
export const secretsFor = (data: RegistryData, container: string, generate: () => Record<string, string>): Record<string, string> => {
    const existing = data.secrets[container]
    if (existing !== undefined) return existing
    const created = generate()
    data.secrets[container] = created
    return created
}

/** The Redis DB index of a namespace: the existing lease, or the lowest free index. Frees indexes of namespaces without a live lease first. */
export const leaseRedisDb = (data: RegistryData, namespace: string): number => {
    const existing = data.redisDbs[namespace]
    if (existing !== undefined) return existing
    const used = new Set(Object.values(data.redisDbs))
    for (let db = 0; db < REDIS_DB_COUNT; db += 1) {
        if (!used.has(db)) {
            data.redisDbs[namespace] = db
            return db
        }
    }
    throw worldError(TestWorldErrorCode.InfrastructureFailed, `all ${REDIS_DB_COUNT} redis databases are leased by live runs (${Object.keys(data.redisDbs).join(", ")})`)
}

/** Frees the Redis DB index of a namespace. */
export const releaseRedisDb = (data: RegistryData, namespace: string): void => {
    delete data.redisDbs[namespace]
}

/** The listen port of a proxy: the existing lease, or the lowest free port of the range. */
export const leaseProxyPort = (data: RegistryData, name: string, owner: { readonly runId: string | null; readonly container: string | null }): number => {
    const existing = data.proxyPorts[name]
    if (existing !== undefined) return existing.port
    const used = new Set(Object.values(data.proxyPorts).map((lease) => lease.port))
    for (let port = PROXY_PORT_FIRST; port <= PROXY_PORT_LAST; port += 1) {
        if (!used.has(port)) {
            data.proxyPorts[name] = { port, runId: owner.runId, container: owner.container }
            return port
        }
    }
    throw worldError(TestWorldErrorCode.InfrastructureFailed, `all toxiproxy ports ${PROXY_PORT_FIRST}-${PROXY_PORT_LAST} are leased`)
}
