import type { Cache } from "@modules/integrations/cache"
import type { Probe } from "@modules/platform/probes"

/**
 * The e2e double of the Cache integration (the only external service of the example apps): entries live in a Map in
 * the test process, keyed like the Redis adapter keys them, and never expire. The e2e world overrides the `CACHE`
 * token with one instance, so the sessions the identity app issues are readable by the spec through it.
 */
export class MemoryCacheClient implements Cache, Probe {
    /** The name the health report lists this probe under. */
    readonly name = "cache"

    private readonly entries = new Map<string, unknown>()

    /** The stored value narrowed by the key, or null when the entry is absent. */
    readonly get: Cache["get"] = (request) => {
        const stored = this.entries.get(this.keyOf(request))
        return Promise.resolve(stored === undefined ? null : request.key.parse(stored))
    }

    /** Stores the value under the key. */
    readonly set: Cache["set"] = (request) => {
        this.entries.set(this.keyOf(request), request.value)
        return Promise.resolve()
    }

    /** Removes the entry. */
    readonly del: Cache["del"] = (request) => {
        this.entries.delete(this.keyOf(request))
        return Promise.resolve()
    }

    /** Always answers: the store is in process. */
    check(): Promise<void> {
        return Promise.resolve()
    }

    /** How many entries the store holds. */
    size(): number {
        return this.entries.size
    }

    private keyOf(request: Parameters<Cache["del"]>[0]): string {
        return [request.key.name, ...request.args].join(":")
    }
}
