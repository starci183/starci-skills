import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { OUTBOX } from "./outbox.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./outbox.module-definition"
import { PostgresOutboxService } from "./outbox.service"

@Module({})
/** Provides the Outbox port over the primary database. */
export class OutboxModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: OUTBOX, useClass: PostgresOutboxService }],
            exports: [OUTBOX],
        }
    }
}
