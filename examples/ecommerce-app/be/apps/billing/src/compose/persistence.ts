import type { DynamicModule } from "@nestjs/common"
import { invoiceEntities, invoiceMigrations } from "@modules/domain/invoice"
import { paymentEntities, paymentMigrations } from "@modules/domain/payment"
import { IdentityApiModule } from "@modules/integrations/identity-api"
import { BILLING_CONNECTION, BILLING_ENTITY_MANAGER, DatabaseModule } from "@modules/platform/database"
import { EventBusModule, eventBusEntities, eventBusMigrations } from "@modules/platform/event-bus"
import { HttpModule } from "@modules/platform/http"
import { InboxModule, inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import type { BillingAppOptions } from "../billing.options"

/** The billing database, identity client, inbox and event transport. */
export const persistenceModules = (options: BillingAppOptions): Array<DynamicModule> => [
    DatabaseModule.register({
        isGlobal: true,
        connections: [
            {
                ...options.database,
                name: BILLING_CONNECTION,
                entities: [...invoiceEntities, ...paymentEntities, ...inboxEntities, ...eventBusEntities],
                migrations: [...invoiceMigrations, ...paymentMigrations, ...inboxMigrations, ...eventBusMigrations],
            },
        ],
    }),
    HttpModule.register({ isGlobal: true }),
    IdentityApiModule.register({ isGlobal: true, ...options.identityApi }),
    InboxModule.register({ isGlobal: true, connection: BILLING_ENTITY_MANAGER }),
    EventBusModule.register({ isGlobal: true, ...options.eventBus, connections: [BILLING_ENTITY_MANAGER] }),
]
