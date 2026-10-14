import type { PaymentService } from "./payment.service"

/** Fixture: a billing-owned verifier obtains the provider secret for the connection before accepting the delivery. */
export class PaymentWebhookVerifier {
    /** A synchronous proof may precede a separate domain intake. */
    assertDelivery(_delivery: object): void {}

    /** An asynchronous proof must finish before a separate domain intake starts. */
    async verifyDelivery(_delivery: object): Promise<void> {}

    /** A proof that can return a promise also requires an await. */
    syncOrAsync(_delivery: object): Promise<void> | void {}

    /** Each provider's combined intake proves and records its own notification inside billing. */
    async acceptCasso(_delivery: object): Promise<void> {}
    async acceptPayos(_delivery: object): Promise<void> {}
    async acceptSepay(_delivery: object): Promise<void> {}
    async acceptSepayFeed(_delivery: object): Promise<void> {}
    async acceptVietcombank(_delivery: object): Promise<void> {}
}

/** Fixture: the literal lowercase `verify` suffix also declares a domain verifier. */
export class PaymentWebhookverify {
    confirm(_delivery: object): void {}
}

/** Fixture: a type alias's spelling cannot grant a general domain service verifier status. */
export type PaymentVerifier = PaymentService
