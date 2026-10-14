import { PaymentService } from "@modules/domain/payment"

/** Fixture: this webhook module explicitly declares its billing-owned combined verifying intake. */
export const webhookVerifiers = [PaymentService.prototype.acceptVerifiedNotification] as const
