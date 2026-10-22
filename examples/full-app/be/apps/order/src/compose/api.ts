import type { DynamicModule, Type } from "@nestjs/common"
import { CheckoutGraphqlModule } from "@features/api/checkout"
import { HealthHttpModule } from "@features/api/health"
import { OrderStatusGraphqlModule } from "@features/realtime/order-status"

/** The order request doors expose health, checkout and live order status. */
export const apiModules = (): Array<DynamicModule | Type<unknown>> => [
    HealthHttpModule.register({}),
    CheckoutGraphqlModule.register({}),
    OrderStatusGraphqlModule.register({}),
]
