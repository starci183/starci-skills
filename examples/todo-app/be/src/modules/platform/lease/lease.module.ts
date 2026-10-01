import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { LEASE } from "./lease.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./lease.module-definition"
import { PostgresLease } from "./lease.service"

@Module({})
/** Provides the Lease port over the primary database. */
export class LeaseModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: LEASE, useClass: PostgresLease }],
            exports: [LEASE],
        }
    }
}
