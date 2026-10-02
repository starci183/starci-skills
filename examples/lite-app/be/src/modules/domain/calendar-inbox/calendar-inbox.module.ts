import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./calendar-inbox.module-definition"
import { CalendarInboxService } from "./calendar-inbox.service"

@Module({})
/** The durable, provider-specific inbox composed once by the API app. */
export class CalendarInboxModule extends ConfigurableModuleClass {
    /** Registers the calendar inbox and exposes its intake to the webhook door. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), CalendarInboxService],
            exports: [CalendarInboxService],
        }
    }
}
