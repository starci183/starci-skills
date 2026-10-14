import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { EVENT_BUS } from "./event-bus.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./event-bus.module-definition"
import { EventBusService } from "./event-bus.service"

@Module({})
/** Provides the transactional lite EventBus publisher, shared by domain intake services. */
export class EventBusModule extends ConfigurableModuleClass {
    /** Registers the publishing capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: EVENT_BUS, useClass: EventBusService }],
            exports: [EVENT_BUS],
        }
    }
}
