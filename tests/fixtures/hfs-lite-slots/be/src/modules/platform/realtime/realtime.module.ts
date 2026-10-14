import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { MemoryRealtimeHubService } from "./memory-realtime-hub.service"
import { REALTIME_HUB } from "./realtime.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./realtime.module-definition"

@Module({})
/** Provides the RealtimeHub port: the push hub of one app instance, shared by its reactors and its realtime doors. */
export class RealtimeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: REALTIME_HUB, useClass: MemoryRealtimeHubService }],
            exports: [REALTIME_HUB],
        }
    }
}
