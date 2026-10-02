/** What a provider delivery carries for its proof (fixture). */
export interface WebhookDelivery {
    readonly rawBody: unknown
    readonly signature: string | undefined
    readonly timestamp?: string
}

/** Fixture: the signature and replay-window proof of a signed webhook; throws when the delivery is not proven. */
export class WebhookSignatureService {
    verify(_delivery: WebhookDelivery): void {}
}
