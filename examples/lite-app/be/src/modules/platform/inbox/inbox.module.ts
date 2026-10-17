import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX } from "./inbox.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbox.module-definition"
import { PostgresInbox } from "./inbox.service"

@Module({})
/** Provides the lite Inbox port; all claims use the domain service's own transaction. */
export class InboxModule extends ConfigurableModuleClass {
    /** Registers the shared inbox once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: INBOX, useClass: PostgresInbox }],
            exports: [INBOX],
        }
    }
}
