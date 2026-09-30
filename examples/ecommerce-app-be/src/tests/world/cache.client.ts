/**
 * The world's door to the REAL Redis of the stack: one logical database per run (so a warm instance never carries a run's
 * entries into the next), the URL the apps under test connect to (through the toxiproxy proxy) and the world's own reads
 * (direct): how many entries the cache integration wrote.
 */
import Redis from "ioredis"
import { portOf, serviceOf } from "./stack.client"
import type { TestStack } from "./stack.client"

const SERVICE = "redis"
const LOGICAL_DATABASES = 16

/** The logical Redis database of a run, from its token: never 0, so a run does not share a database with a developer's default one. */
export const cacheDatabaseOf = (runId: string): number => 1 + (Number.parseInt(runId, 16) % (LOGICAL_DATABASES - 1))

/** The `redis://` URL of the run's database; `proxied` goes through the toxiproxy proxy (the apps under test). */
export const cacheUrlOf = (stack: TestStack, runId: string, proxied: boolean): string => {
    const port = portOf(serviceOf(stack, SERVICE))
    return `redis://${port.host}:${proxied ? port.proxy : port.direct}/${cacheDatabaseOf(runId)}`
}

const withCache = async <T>(stack: TestStack, runId: string, act: (redis: Redis) => Promise<T>): Promise<T> => {
    const redis = new Redis(cacheUrlOf(stack, runId, false), { lazyConnect: true, maxRetriesPerRequest: 1 })
    await redis.connect()
    try {
        return await act(redis)
    } finally {
        redis.disconnect()
    }
}

/** How many entries the run's database holds. */
export const cacheSize = (stack: TestStack, runId: string): Promise<number> =>
    withCache(stack, runId, (redis) => redis.dbsize())

/** Empties the run's database: at the start of the run and at its end. */
export const flushCache = (stack: TestStack, runId: string): Promise<void> =>
    withCache(stack, runId, async (redis) => {
        await redis.flushdb()
    })
