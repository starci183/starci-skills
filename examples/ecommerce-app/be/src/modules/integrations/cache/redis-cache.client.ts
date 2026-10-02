import { Injectable } from "@nestjs/common"
import type { OnApplicationShutdown } from "@nestjs/common"
import type { Probe } from "@modules/platform/probes"
import { cacheKeyText } from "./cache-key.mapper"
import type { CacheRequest } from "./cache.contracts"
import { InjectCacheOptions, InjectRedisFactory } from "./cache.decorators"
import type { CacheOptions } from "./cache.options"
import type { Cache, RedisDriver, RedisFactory } from "./cache.port"
import { CacheError, CacheErrorCode } from "./errors/cache.error"

@Injectable()
/** The Redis adapter of the Cache port and the health probe of the cache; the driver is built by the injected factory, whose default the module composes. */
export class RedisCacheClient implements Cache, Probe, OnApplicationShutdown {
    /** The name the health report lists this probe under. */
    readonly name = "cache"

    private readonly redis: RedisDriver

    constructor(@InjectCacheOptions() options: CacheOptions, @InjectRedisFactory() factory: RedisFactory) {
        this.redis = factory.create(options.url.reveal(), {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            commandTimeout: options.timeoutMs,
        })
    }

    /** The stored value, or null when the entry is absent, expired or not a value of the declared shape. */
    async get<TValue>(request: CacheRequest<TValue>): Promise<TValue | null> {
        const stored = await this.run(() => this.redis.get(cacheKeyText(request)))
        return stored === null ? null : request.key.parse(this.decode(stored))
    }

    /** Stores `value` under the key with the time to live the key declares. */
    async set<TValue>(request: CacheRequest<TValue> & { readonly value: TValue }): Promise<void> {
        await this.run(() =>
            this.redis.set(cacheKeyText(request), JSON.stringify(request.value), "EX", request.key.ttl.seconds),
        )
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
