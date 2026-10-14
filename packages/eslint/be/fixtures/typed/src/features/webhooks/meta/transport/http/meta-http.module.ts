import { MetaSubscriptionService } from "@modules/domain/payment/meta-verifier.service"

/** Fixture: a general domain service becomes a verifier only for this provider's declared method. */
export const webhookVerifiers = [MetaSubscriptionService.prototype.challenge] as const
