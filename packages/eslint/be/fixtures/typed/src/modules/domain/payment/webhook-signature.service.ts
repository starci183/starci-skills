/** A lookalike of the platform signature service, declared by a domain owner: it proves nothing. */
export class WebhookSignatureService {
    verify(_delivery: object): void {}
}
