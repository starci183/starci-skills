import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { TestWorldErrorCode, worldError } from "../../errors"
import { realClock } from "./poll"
import type { Clock } from "./poll"

/** What tunes a lock. */
export interface LockOptions {
    /** Give up after this long (default 10 minutes: a first cluster create pulls images). */
    readonly timeoutMs?: number
    /** A lock older than this is considered abandoned (default 20 minutes). */
    readonly staleMs?: number
    readonly clock?: Clock
}

const alive = (pid: number): boolean => {
    try {
        process.kill(pid, 0)
        return true
    } catch (cause) {
        return (cause as NodeJS.ErrnoException).code === "EPERM"
    }
}

const isStale = async (dir: string, staleMs: number, now: number): Promise<boolean> => {
    try {
        const owner = JSON.parse(await readFile(join(dir, "owner.json"), "utf8")) as { pid?: number; at?: number }
        if (typeof owner.at === "number" && now - owner.at > staleMs) return true
        return typeof owner.pid === "number" ? !alive(owner.pid) : false
    } catch {
        try {
            return now - (await stat(dir)).mtimeMs > staleMs
        } catch {
            return true
        }
    }
}

/** Runs `action` holding a cross-process mkdir-based lock at `dir`; abandoned locks (dead owner, too old) are broken. */
export const withLock = async <T>(dir: string, action: () => Promise<T>, options: LockOptions = {}): Promise<T> => {
    const clock = options.clock ?? realClock
    const timeoutMs = options.timeoutMs ?? 600_000
    const staleMs = options.staleMs ?? 1_200_000
    await mkdir(dirname(dir), { recursive: true })
    const deadline = clock.now() + timeoutMs
    for (;;) {
        try {
            await mkdir(dir)
            break
        } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== "EEXIST") throw cause
            if (await isStale(dir, staleMs, Date.now())) {
                await rm(dir, { recursive: true, force: true })
                continue
            }
            if (clock.now() >= deadline) {
                throw worldError(TestWorldErrorCode.InfrastructureFailed, `timed out after ${timeoutMs} ms waiting for the lock ${dir}; remove it if no starci app stack process is running`)
            }
            await clock.pause(200)
        }
    }
    try {
        await writeFile(join(dir, "owner.json"), JSON.stringify({ pid: process.pid, at: Date.now() }))
        return await action()
    } finally {
        await rm(dir, { recursive: true, force: true })
    }
}
