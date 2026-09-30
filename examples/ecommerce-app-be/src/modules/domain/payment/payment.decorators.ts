import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PaymentService } from "./payment.service"

/** Token of the PaymentService of this capability, for the capabilities that use it. */
export const PAYMENT_SERVICE: unique symbol = Symbol("domain.payment.service")

/** Injects the PaymentService. Parameter type: PaymentService. */
export const InjectPaymentService = (): TypedParameterDecorator<PaymentService> =>
    injector<PaymentService>(PAYMENT_SERVICE)
