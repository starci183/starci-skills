import type { RunRedis } from "../contracts"
import type { ServiceDefinition } from "./definition"

/** Redis: one shared server per image; each namespace leases one DB index (0..15) from the registry. */
export const redisService: ServiceDefinition<RunRedis> = {
    name: "redis",
    port: 6379,
    newSecrets: () => ({}),
    spec: () => ({ env: {}, command: ["redis-server", "--save", "", "--appendonly", "no"] }),
    ready: async (target) => {
        const [reply] = await target.net.redis(target.host, target.port, [["PING"]])
        return reply === "PONG"
    },
    provision: async (target, input) => {
        const db = await input.leaseRedisDb()
        await target.net.redis(target.host, target.port, [["SELECT", String(db)], ["FLUSHDB"]])
        return { run: { db } }
    },
    reset: async (target, run) => {
        await target.net.redis(target.host, target.port, [["SELECT", String(run.db)], ["FLUSHDB"]])
    },
    deprovision: async (target, run, input) => {
        await target.net.redis(target.host, target.port, [["SELECT", String(run.db)], ["FLUSHDB"]])
        await input.releaseRedisDb()
    },
}
