import { Injectable } from "@nestjs/common"
import type { OnApplicationShutdown } from "@nestjs/common"
import Redis from "ioredis"
import type { RateLimitHitParams, RateLimitStore } from "@modules/platform/http-security"
import { InjectCacheOptions } from "./cache.decorators"
import type { CacheOptions } from "./cache.options"
import { CacheError, CacheErrorCode } from "./errors/cache.error"

@Injectable()
/**
 * The Redis client of the cache integration. The rate limiter counts here: one key per caller and fixed window, increased
 * atomically and expiring with its window, so every replica of the app reads the same count. The connection opens on the
 * first command; a failure to reach Redis is the declared cache-unavailable error.
 */
export class RedisCacheClient implements RateLimitStore, OnApplicationShutdown {
    private readonly redis: Redis

    constructor(@InjectCacheOptions() options: CacheOptions) {
        this.redis = new Redis(options.url.reveal(), {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            commandTimeout: options.timeoutMs,
        })
    }

    /** Counts one request in the key's current window (the window starts with its first request) and answers the count. */
    async hit(params: RateLimitHitParams): Promise<number> {
        const key = `rate-limit:${params.key}`
        const replies = await this.run(() => this.redis.multi().incr(key).pexpire(key, params.windowMs, "NX").exec())
        const counted = replies?.[0]?.[1]
        if (typeof counted !== "number") {
            throw new CacheError({ code: CacheErrorCode.Unavailable, params: { reason: "transaction-aborted" } })
        }
        return counted
    }

    /** Closes the connection when the app stops. */
    async onApplicationShutdown(): Promise<void> {
        if (this.redis.status !== "wait") await this.redis.quit()
    }

    private async run<TResult>(command: () => Promise<TResult>): Promise<TResult> {
        try {
            if (this.redis.status === "wait") await this.redis.connect()
            return await command()
        } catch (cause) {
            throw new CacheError({ code: CacheErrorCode.Unavailable, cause })
        }
    }
}
