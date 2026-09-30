import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import { PaymentService } from "./payment.service"

/** Injects the PaymentService of this capability. Parameter type: PaymentService. */
export const InjectPaymentService = (): TypedParameterDecorator<PaymentService> => injector<PaymentService>(PaymentService)
