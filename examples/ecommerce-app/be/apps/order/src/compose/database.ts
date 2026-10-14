import type { DynamicModule } from "@nestjs/common"
import { cartEntities, cartMigrations } from "@modules/domain/cart"
import { catalogEntities, catalogMigrations } from "@modules/domain/catalog"
import { loyaltyEntities, loyaltyMigrations } from "@modules/domain/loyalty"
import { orderEntities, orderMigrations } from "@modules/domain/order"
import { ORDER_CONNECTION, DatabaseModule } from "@modules/platform/database"
import { eventBusEntities, eventBusMigrations } from "@modules/platform/event-bus"
import { inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { jobsEntities, jobsMigrations } from "@modules/platform/jobs"
import { queueEntities, queueMigrations } from "@modules/platform/queue"
import { sagaEntities, sagaMigrations } from "@modules/platform/saga"
import { orderSummaryEntities, orderSummaryMigrations } from "@modules/projections/order-summary"
import type { OrderAppOptions } from "../order.options"

/** The order connection owns the domain, projection and background stores and their migrations. */
export const databaseModules = (options: OrderAppOptions): Array<DynamicModule> => [
    DatabaseModule.register({
        isGlobal: true,
        connections: [
            {
                ...options.database,
                name: ORDER_CONNECTION,
                entities: [
                    ...catalogEntities,
                    ...cartEntities,
                    ...orderEntities,
                    ...loyaltyEntities,
                    ...orderSummaryEntities,
                    ...inboxEntities,
                    ...sagaEntities,
                    ...eventBusEntities,
                    ...queueEntities,
                    ...jobsEntities,
                ],
                migrations: [
                    ...catalogMigrations,
                    ...cartMigrations,
                    ...orderMigrations,
                    ...loyaltyMigrations,
                    ...orderSummaryMigrations,
                    ...inboxMigrations,
                    ...sagaMigrations,
                    ...eventBusMigrations,
                    ...queueMigrations,
                    ...jobsMigrations,
                ],
            },
        ],
    }),
]
