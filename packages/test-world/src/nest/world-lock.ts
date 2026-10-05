/**
 * The outage lock of a run. The spec files of one run share the stack (the same databases, realm, Redis DB and proxies), so an
 * outage one file injects (`world.infra.<service>.cut()`, `latency(ms)`, `during(fn)`, `keycloak.rotateClientSecret`) would
 * break whatever another file runs at the same time under `--maxWorkers=2`. The lock makes that impossible by construction:
 *
 * - every phase of a world that uses the shared stack (its boot, each test, its stop) holds the lock SHARED;
 * - every outage call takes it EXCLUSIVE before it touches the stack, and keeps it until the outage is restored (or the world
 *   stops). The outage API takes the lock itself, so a spec cannot forget it.
 *
 * Writers win: while a writer holds or waits, no new shared holder enters, so an outage waits only for the tests already
 * running in other files, and those wait only for the outage window. A world that waits to become the writer gives up its own
 * shared hold while it waits, so two outage specs never wait on each other. The lock lives in the run directory (removed by
 * the teardown): a mkdir-based writer (`exclusive.lock/owner`) and one file per shared holder (`shared/<owner>`), each naming
 * the pid that holds it; a holder whose process is gone is broken, so a crashed worker never wedges the run.
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { TestWorldErrorCode, worldError } from "../errors"
import { processAlive } from "../stack/registry"
import type { IsAlive } from "../stack/registry"
import { pause as realPause } from "./poll"

/** What a test of the library substitutes. */
export interface WorldLockOptions {
    readonly isAlive?: IsAlive
    /** The pid recorded for this holder (default: this process). */
    readonly pid?: number
    /** The pause between two attempts in milliseconds (default 100). */
    readonly intervalMs?: number
    readonly pause?: (ms: number) => Promise<void>
}

const WRITER = "exclusive.lock"
const SHARED = "shared"
const OWNER_FILE = "owner"
/** A writer directory without its owner file is a mkdir that has not written yet, unless it is older than this. */
const ORPHAN_WRITER_MS = 5000
const DEFAULT_INTERVAL_MS = 100

interface Holder {
    readonly owner: string
    readonly pid: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const readHolder = (file: string): Holder | null => {
    try {
        const parsed: unknown = JSON.parse(readFileSync(file, "utf8"))
        return isRecord(parsed) && typeof parsed.owner === "string" && typeof parsed.pid === "number" ? { owner: parsed.owner, pid: parsed.pid } : null
    } catch {
        return null
    }
}

const isCode = (cause: unknown, code: string): boolean => isRecord(cause) && cause.code === code

/** One world's view of the run's outage lock; `owner` tells this world's holds from every other world's. */
export class WorldLock {
    private readonly isAlive: IsAlive
    private readonly pid: number
    private readonly intervalMs: number
    private readonly pause: (ms: number) => Promise<void>
    private sharing = false
    private writing = false
    private acquiring: Promise<void> | null = null
    private closed = false

    constructor(
        private readonly dir: string,
        private readonly owner: string,
        options: WorldLockOptions = {},
    ) {
        this.isAlive = options.isAlive ?? processAlive
        this.pid = options.pid ?? process.pid
        this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS
        this.pause = options.pause ?? realPause
        mkdirSync(join(dir, SHARED), { recursive: true })
    }

    /** Whether this world holds the lock exclusively (an outage of its own is in force). */
    get exclusive(): boolean {
        return this.writing
    }

    /** Holds the lock shared: waits while another world holds it exclusively or waits to. Idempotent. */
    async share(): Promise<void> {
        this.ensureOpen()
        if (this.sharing) return
        for (;;) {
            if (this.writing || this.otherWriter() === null) {
                this.writeShared()
                // A writer that arrived between the check and the write sees this holder and waits; one that was already there wins.
                if (this.writing || this.otherWriter() === null) {
                    this.sharing = true
                    return
                }
                this.removeShared()
            }
            await this.wait()
        }
    }

    /** Gives the shared hold back. */
    unshare(): void {
        if (!this.sharing) return
        this.sharing = false
        this.removeShared()
    }

    /**
     * Takes the lock exclusively (re-entrant): first the writer slot, then the wait for every other world's shared hold to end.
     * While it waits for another writer, this world's own shared hold is given up, so two outage specs never wait on each other.
     */
    async acquire(): Promise<void> {
        this.ensureOpen()
        if (this.acquiring !== null) return this.acquiring
        if (this.writing) return
        const acquiring = this.acquireExclusive()
        this.acquiring = acquiring
        try {
            await acquiring
        } finally {
            this.acquiring = null
        }
    }

    private async acquireExclusive(): Promise<void> {
        const wasSharing = this.sharing
        if (wasSharing) this.removeShared()
        try {
            while (!this.tryWriter()) {
                this.breakStaleWriter()
                await this.wait()
            }
            this.writing = true
            while (this.otherSharedHolders().length > 0) await this.wait()
        } catch (cause) {
            this.release()
            throw cause
        } finally {
            if (wasSharing && this.sharing) this.writeShared()
        }
    }

    /** Ends this world's exclusive hold; its shared hold (if any) stays. */
    release(): void {
        if (!this.writing) return
        this.writing = false
        rmSync(join(this.dir, WRITER), { recursive: true, force: true })
        if (this.sharing) this.writeShared()
    }

    /** Releases every hold of this world and refuses further use; a wait still in flight ends with a failure. */
    close(): void {
        this.closed = true
        this.release()
        this.sharing = false
        this.removeShared()
    }

    private ensureOpen(): void {
        if (this.closed) throw worldError(TestWorldErrorCode.NotBooted, "the world stopped: its outage lock is closed")
    }

    private async wait(): Promise<void> {
        await this.pause(this.intervalMs)
        this.ensureOpen()
    }

    private sharedFile(owner: string): string {
        return join(this.dir, SHARED, owner)
    }

    private writeShared(): void {
        writeFileSync(this.sharedFile(this.owner), JSON.stringify({ owner: this.owner, pid: this.pid } satisfies Holder))
    }

    private removeShared(): void {
        rmSync(this.sharedFile(this.owner), { force: true })
    }

    /** The shared holders other than this world; a holder whose process is gone is removed. */
    private otherSharedHolders(): ReadonlyArray<Holder> {
        const holders: Array<Holder> = []
        let names: ReadonlyArray<string> = []
        try {
            names = readdirSync(join(this.dir, SHARED))
        } catch (cause) {
            if (isCode(cause, "ENOENT")) return []
            throw cause
        }
        for (const name of names) {
            if (name === this.owner) continue
            const file = this.sharedFile(name)
            const holder = readHolder(file)
            if (holder !== null && !this.isAlive(holder.pid)) {
                rmSync(file, { force: true })
                continue
            }
            // A file being written (no content yet) is a live holder.
            holders.push(holder ?? { owner: name, pid: -1 })
        }
        return holders
    }

    /** The writer when it is another world (live or not yet written), else null. */
    private otherWriter(): Holder | null {
        const directory = join(this.dir, WRITER)
        let exists = true
        try {
            statSync(directory)
        } catch {
            exists = false
        }
        if (!exists) return null
        const holder = readHolder(join(directory, OWNER_FILE))
        if (holder === null) return { owner: "", pid: -1 }
        if (holder.owner === this.owner) return null
        if (!this.isAlive(holder.pid)) {
            this.breakStaleWriter()
            return null
        }
        return holder
    }

    private tryWriter(): boolean {
        const directory = join(this.dir, WRITER)
        try {
            mkdirSync(directory)
        } catch (cause) {
            if (isCode(cause, "EEXIST")) return false
            throw cause
        }
        writeFileSync(join(directory, OWNER_FILE), JSON.stringify({ owner: this.owner, pid: this.pid } satisfies Holder))
        return true
    }

    /** Breaks a writer whose process is gone (or a mkdir that never wrote its owner): rename first, so one breaker wins. */
    private breakStaleWriter(): void {
        const directory = join(this.dir, WRITER)
        const holder = readHolder(join(directory, OWNER_FILE))
        if (holder !== null) {
            if (holder.owner === this.owner || this.isAlive(holder.pid)) return
        } else {
            try {
                if (Date.now() - statSync(directory).mtimeMs < ORPHAN_WRITER_MS) return
            } catch {
                return
            }
        }
        const graveyard = `${directory}.stale.${this.pid}.${Date.now()}`
        try {
            renameSync(directory, graveyard)
            rmSync(graveyard, { recursive: true, force: true })
        } catch {
            // another breaker won
        }
    }
}
