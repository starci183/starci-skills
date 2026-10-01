import { tmpdir } from "node:os"
import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { Registry, leaseProxyPort, leaseRedisDb, releaseRedisDb, secretsFor } from "./registry"

const scratch = mkdtempSync(join(tmpdir(), "starci-tw-reg-"))
let counter = 0
const home = (): string => join(scratch, `h${(counter += 1)}`)
const lease = (namespace: string, runId: string, pid: number) => ({ namespace, runId, pid, since: "2026-01-01T00:00:00.000Z", containers: [] })
const fastPause = (): Promise<void> => new Promise((done) => setImmediate(done))

describe("registry", () => {
    it("drops leases of dead pids on every read, with the redis and proxy leases hanging off them", async () => {
        const alive = new Set([100, 200])
        const registry = new Registry({ dir: home(), isAlive: (pid) => alive.has(pid), pause: fastPause })
        await registry.update((data) => {
            data.leases.push(lease("live_ns", "r1", 100), lease("dead_ns", "r2", 200))
            leaseRedisDb(data, "live_ns")
            leaseRedisDb(data, "dead_ns")
            leaseProxyPort(data, "r1-redis", { runId: "r1", container: null })
            leaseProxyPort(data, "r2-redis", { runId: "r2", container: null })
            leaseProxyPort(data, "kafka-abc", { runId: null, container: "k" })
        })
        alive.delete(200)
        const data = registry.read()
        assert.deepEqual(data.leases.map((entry) => entry.runId), ["r1"])
        assert.deepEqual(Object.keys(data.redisDbs), ["live_ns"])
        assert.deepEqual(Object.keys(data.proxyPorts).sort(), ["kafka-abc", "r1-redis"])
    })

    it("allocates redis DB indexes per namespace, reuses them, and frees them", () => {
        const data = new Registry({ dir: home() }).read()
        assert.equal(leaseRedisDb(data, "a"), 0)
        assert.equal(leaseRedisDb(data, "b"), 1)
        assert.equal(leaseRedisDb(data, "a"), 0)
        releaseRedisDb(data, "a")
        assert.equal(leaseRedisDb(data, "c"), 0)
        for (let index = 0; index < 14; index += 1) leaseRedisDb(data, `n${index}`)
        assert.throws(() => leaseRedisDb(data, "overflow"), /redis databases/)
    })

    it("leases proxy ports from 30100 upward and keeps a name's port stable", () => {
        const data = new Registry({ dir: home() }).read()
        assert.equal(leaseProxyPort(data, "x", { runId: "r", container: null }), 30100)
        assert.equal(leaseProxyPort(data, "y", { runId: "r", container: null }), 30101)
        assert.equal(leaseProxyPort(data, "x", { runId: "r", container: null }), 30100)
    })

    it("generates a container's secrets once and returns the stored ones afterwards", async () => {
        const registry = new Registry({ dir: home() })
        const first = await registry.update((data) => secretsFor(data, "c1", () => ({ password: "p1" })))
        const second = await registry.update((data) => secretsFor(data, "c1", () => ({ password: "p2" })))
        assert.equal(first.password, "p1")
        assert.equal(second.password, "p1")
    })

    it("serialises concurrent updates from two registry handles under the lock", async () => {
        const dir = home()
        const one = new Registry({ dir, pause: fastPause })
        const two = new Registry({ dir, pause: fastPause })
        await Promise.all(
            Array.from({ length: 20 }, (_, index) =>
                (index % 2 === 0 ? one : two).update(async (data) => {
                    const before = Object.keys(data.notes).length
                    await fastPause()
                    data.notes[`k${index}`] = String(before)
                }),
            ),
        )
        assert.equal(Object.keys(one.read().notes).length, 20)
    })

    it("breaks a lock whose owner is dead and refuses to break one held by a live pid", async () => {
        const dir = home()
        const registry = new Registry({ dir, isAlive: (pid) => pid === 1, pause: fastPause })
        mkdirSync(join(dir, "up.lock"), { recursive: true })
        writeFileSync(join(dir, "up.lock", "owner"), JSON.stringify({ pid: 4242 }))
        assert.equal(await registry.lock("up", async () => "ran"), "ran")
        assert.equal(existsSync(join(dir, "up.lock")), false)
        mkdirSync(join(dir, "up.lock"), { recursive: true })
        writeFileSync(join(dir, "up.lock", "owner"), JSON.stringify({ pid: 1 }))
        await assert.rejects(registry.lock("up", async () => "never", { timeoutMs: 200, intervalMs: 50 }), /stayed held/)
    })
})
