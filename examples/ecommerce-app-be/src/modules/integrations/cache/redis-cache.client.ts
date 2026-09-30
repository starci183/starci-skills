import { Injectable } from "@nestjs/common"
import type { OnApplicationShutdown } from "@nestjs/common"
import Redis from "ioredis"
import type { Probe } from "@modules/platform/probes"
import { cacheKeyText } from "./cache-key.mapper"
import type { CacheRequest } from "./cache.contracts"
import { InjectCacheOptions } from "./cache.decorators"
import type { CacheOptions } from "./cache.options"
import type { Cache } from "./cache.port"
import { CacheError, CacheErrorCode } from "./errors/cache.error"

@Injectable()
/** The Redis adapter of the Cache port and the health probe of the cache; the only file that imports the Redis library. */
export class RedisCache implements Cache, Probe, OnApplicationShutdown {
    /** The name the health report lists this probe under. */
    readonly name = "cache"

    private readonly redis: Redis

    constructor(@InjectCacheOptions() options: CacheOptions) {
        this.redis = new Redis(options.url.reveal(), { lazyConnect: true, maxRetriesPerRequest: 1 })
    }

    /** The stored value, or null when the entry is absent, expired or not a value of the declared shape. */
    async get<TValue>(request: CacheRequest<TValue>): Promise<TValue | null> {
        const stored = await this.run(() => this.redis.get(cacheKeyText(request)))
        return stored === null ? null : request.key.parse(this.decode(stored))
    }

    /** Stores `value` under the key with the time to live the key declares. */
    async set<TValue>(request: CacheRequest<TValue> & { readonly value: TValue }): Promise<void> {
        await this.run(() => this.redis.set(cacheKeyText(request), JSON.stringify(request.value), "EX", request.key.ttl.seconds))
    }

    /** Removes the entry. */
    async del(request: CacheRequest<unknown>): Promise<void> {
        await this.run(() => this.redis.del(cacheKeyText(request)))
    }

    /** Resolves when the store answers a ping. */
    async check(): Promise<void> {
        await this.run(() => this.redis.ping())
    }

    /** Closes the connection when the app shuts down. */
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

    private decode(stored: string): unknown {
        try {
            return JSON.parse(stored)
        } catch (cause) {
            throw new CacheError({ code: CacheErrorCode.ReplyUnreadable, cause })
        }
    }
}
