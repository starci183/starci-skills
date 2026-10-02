import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX } from "@modules/platform/inbox"
import { SAGA_SERVICE } from "./saga.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./saga.module-definition"
import { SagaInbox } from "./saga-inbox.service"
import { SagaService } from "./saga.service"

@Module({})
/** The saga capability: the persisted, fenced state of the sagas of one service and the inbox its events are claimed in (a table of its own, on the connection of the service). */
export class SagaModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that orchestrates a saga. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: SagaInbox },
                SagaService,
                { provide: SAGA_SERVICE, useExisting: SagaService },
            ],
            exports: [SAGA_SERVICE],
        }
    }
}
