import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LoyaltyService } from "./loyalty.service"

/** Token of the LoyaltyService of this capability, for the capabilities that use it. */
export const LOYALTY_SERVICE: unique symbol = Symbol("domain.loyalty.service")

/** Injects the LoyaltyService. Parameter type: LoyaltyService. */
export const InjectLoyaltyService = (): TypedParameterDecorator<LoyaltyService> =>
    injector<LoyaltyService>(LOYALTY_SERVICE)
