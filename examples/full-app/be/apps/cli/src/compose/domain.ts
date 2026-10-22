import type { DynamicModule } from "@nestjs/common"
import { OrderExpiryTicksModule } from "@modules/domain/order-expiry-ticks"
import { OrderExpiryModule } from "@modules/queues/order-expiry"
import type { CliEnv } from "../cli.env"

/** The operator capabilities used by CLI commands. */
export const domainModules = (options: CliEnv): Array<DynamicModule> => [
    { module: OrderExpiryModule, global: true },
    OrderExpiryTicksModule.register({ isGlobal: true, ...options.orderExpiry }),
]
