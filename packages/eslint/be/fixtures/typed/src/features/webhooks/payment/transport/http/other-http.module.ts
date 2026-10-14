import { PaymentService } from "@modules/domain/payment"

/** Fixture: another HTTP module cannot declare the payment webhook's verifier. */
export const webhookVerifiers = [PaymentService.prototype.refund] as const
