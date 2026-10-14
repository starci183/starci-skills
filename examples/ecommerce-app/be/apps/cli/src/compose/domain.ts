import type { DynamicModule } from "@nestjs/common"
import { OrderExpiryTicksModule } from "@modules/domain/order-expiry-ticks"
import { OrderExpiryModule } from "@modules/queues/order-expiry"
import type { CliAppOptions } from "../cli.options"

/** The operator capabilities used by CLI commands. */
export const domainModules = (options: CliAppOptions): Array<DynamicModule> => [
    { module: OrderExpiryModule, global: true },
    OrderExpiryTicksModule.register({ isGlobal: true, ...options.orderExpiry }),
]
