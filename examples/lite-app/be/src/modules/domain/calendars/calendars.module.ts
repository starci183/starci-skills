import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./calendars.module-definition"
import { CalendarsService } from "./calendars.service"

@Module({})
/** The calendars capability over the primary Supabase PostgreSQL connection. */
export class CalendarsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), CalendarsService], exports: [CalendarsService] }
    }
}
