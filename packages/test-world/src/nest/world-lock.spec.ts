import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, test } from "node:test"
import { WorldLock } from "./world-lock"

const FAST = { intervalMs: 5 }
const lockDir = (): string => mkdtempSync(join(tmpdir(), "tw-lock-"))

/** Resolves on the next turns of the event loop: long enough for a pending lock to poll several times. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 60))

/** Tracks whether a promise has settled. */
const track = (promise: Promise<void>): { readonly done: () => boolean; readonly promise: Promise<void> } => {
    let settled = false
    const tracked = promise.then(() => {
        settled = true
    })
    return { done: () => settled, promise: tracked }
}

describe("world outage lock", () => {
    test("shared holders run together; an exclusive hold waits for every other shared holder and then keeps new ones out until released", async () => {
        const dir = lockDir()
        const outage = new WorldLock(dir, "outage", FAST)
        const other = new WorldLock(dir, "other", FAST)
        await outage.share()
        await other.share()
        const acquiring = track(outage.acquire())
        await settle()
        assert.equal(acquiring.done(), false, "the outage waits for the other file's running test")
        other.unshare()
        await acquiring.promise
        assert.equal(outage.exclusive, true)
        const entering = track(other.share())
        await settle()
        assert.equal(entering.done(), false, "a test of another file waits while the outage is in force")
        outage.release()
        await entering.promise
        assert.equal(outage.exclusive, false)
        outage.close()
        other.close()
    })

    test("a waiting writer keeps new shared holders out, so an outage is never starved", async () => {
        const dir = lockDir()
        const outage = new WorldLock(dir, "outage", FAST)
        const running = new WorldLock(dir, "running", FAST)
        const late = new WorldLock(dir, "late", FAST)
        await running.share()
        const acquiring = track(outage.acquire())
        await settle()
        const entering = track(late.share())
        await settle()
        assert.equal(acquiring.done(), false)
        assert.equal(entering.done(), false, "a new test does not slip in ahead of the waiting outage")
        running.unshare()
        await acquiring.promise
        await settle()
        assert.equal(entering.done(), false)
        outage.release()
        await entering.promise
        for (const lock of [outage, running, late]) lock.close()
    })

    test("two outage files that both hold a shared test never deadlock: each gives its shared hold up while it waits for the writer slot", async () => {
        const dir = lockDir()
        const first = new WorldLock(dir, "first", FAST)
        const second = new WorldLock(dir, "second", FAST)
        await first.share()
        await second.share()
        const order: Array<string> = []
        const firstOutage = first.acquire().then(async () => {
            order.push("first in")
            await settle()
            order.push("first out")
            first.release()
            first.unshare() // the outage test ends
        })
        const secondOutage = second.acquire().then(async () => {
            order.push("second in")
            await settle()
            order.push("second out")
            second.release()
            second.unshare() // the outage test ends
        })
        await Promise.all([firstOutage, secondOutage])
        assert.equal(order.length, 4)
        assert.match(order.join(","), /^(first in,first out,second in,second out|second in,second out,first in,first out)$/, "the outages never overlap")
        first.close()
        second.close()
    })

    test("the exclusive hold is re-entrant and the holder's own tests still enter", async () => {
        const dir = lockDir()
        const outage = new WorldLock(dir, "outage", FAST)
        await outage.acquire()
        await outage.acquire()
        await outage.share()
        outage.unshare()
        assert.equal(outage.exclusive, true)
        outage.close()
        assert.deepEqual(readdirSync(join(dir, "shared")), [])
    })

    test("a holder whose process is gone is broken: a dead writer and a dead shared holder never wedge the run", async () => {
        const dir = lockDir()
        const alive = (pid: number): boolean => pid !== 4242
        mkdirSync(join(dir, "exclusive.lock"), { recursive: true })
        writeFileSync(join(dir, "exclusive.lock", "owner"), JSON.stringify({ owner: "crashed", pid: 4242 }))
        mkdirSync(join(dir, "shared"), { recursive: true })
        writeFileSync(join(dir, "shared", "crashed-reader"), JSON.stringify({ owner: "crashed-reader", pid: 4242 }))
        const lock = new WorldLock(dir, "live", { ...FAST, isAlive: alive })
        await lock.share()
        lock.unshare()
        await lock.acquire()
        assert.equal(lock.exclusive, true)
        lock.close()
    })

    test("closing the lock ends a pending wait with a failure and leaves nothing held", async () => {
        const dir = lockDir()
        const holder = new WorldLock(dir, "holder", FAST)
        const waiter = new WorldLock(dir, "waiter", FAST)
        await holder.acquire()
        const waiting = waiter.share()
        await settle()
        waiter.close()
        await assert.rejects(waiting, /outage lock is closed/)
        holder.close()
        const fresh = new WorldLock(dir, "fresh", FAST)
        await fresh.acquire()
        fresh.close()
    })
})
