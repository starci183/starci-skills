import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { INBOX, CLAIM_MANAGERS } from "./inbox.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbox.module-definition"
import { PostgresInbox } from "./inbox.service"

@Module({})
/** Provides the Inbox port over the claims table of the connection the app names. */
export class InboxModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                {
                    provide: CLAIM_MANAGERS,
                    useFactory: (manager: EntityManager) => [manager],
                    inject: [options.connection],
                },
                { provide: INBOX, useClass: PostgresInbox },
            ],
            exports: [INBOX],
        }
    }
}
