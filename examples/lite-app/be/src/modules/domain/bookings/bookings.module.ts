import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bookings.module-definition"
import { BookingsService } from "./bookings.service"

@Module({})
/** The bookings capability over the primary Supabase PostgreSQL connection. */
export class BookingsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), BookingsService], exports: [BookingsService] }
    }
}
