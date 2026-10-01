import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { RATE_LIMIT_STORE } from "@modules/platform/http-security"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./cache.module-definition"
import { RedisCacheClient } from "./redis-cache.client"

@Module({})
/** Provides the stores kept in the stack's Redis: the shared counter of the rate limiter. */
export class CacheModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that counts requests. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: RATE_LIMIT_STORE, useClass: RedisCacheClient }],
            exports: [RATE_LIMIT_STORE],
        }
    }
}
