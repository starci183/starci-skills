import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { EVENT_BUS, EVENT_CONSUMER_REGISTRY } from "./event-bus.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./event-bus.module-definition"
import { EventBusService } from "./event-bus.service"

@Module({})
/** The event bus of a service: publishing and consumer registration over the messaging capability the app registers. */
export class EventBusModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that publishes or consumes events. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                EventBusService,
                { provide: EVENT_BUS, useExisting: EventBusService },
                { provide: EVENT_CONSUMER_REGISTRY, useExisting: EventBusService },
            ],
            exports: [EVENT_BUS, EVENT_CONSUMER_REGISTRY],
        }
    }
}
