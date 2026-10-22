import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import Redis from "ioredis"
import { CACHE, REDIS_FACTORY } from "./cache.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./cache.module-definition"
import type { RedisDriver, RedisDriverOptions } from "./cache.port"
import { RedisCacheClient } from "./redis-cache.client"

@Module({})
/** Provides the Cache port backed by Redis. */
export class CacheModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that caches. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: REDIS_FACTORY,
                    useValue: {
                        create: (url: string, options: RedisDriverOptions): RedisDriver => new Redis(url, options),
                    },
                },
                { provide: CACHE, useClass: RedisCacheClient },
            ],
            exports: [CACHE],
        }
    }
}
