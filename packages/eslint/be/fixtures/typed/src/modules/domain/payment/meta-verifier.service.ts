import { CommandBus } from "@nestjs/cqrs"

/** Fixture: the domain checks Meta's subscription credentials and returns only the requested echo. */
export class MetaWebhookVerifier {
    constructor(private readonly commands: CommandBus) {}

    challenge(_query: object): string { return "provider-challenge" }
    async asyncChallenge(_query: object): Promise<string> { return "provider-challenge" }
    syncOrAsyncChallenge(_query: object): string | Promise<string> { return "provider-challenge" }
    verifyDelivery(_delivery: object): void {}
    voidChallenge(_query: object): void {}
    dispatchingProof(_delivery: object): void { this.commands.execute({}) }
    dispatchingChallenge(_query: object): string {
        this.commands.execute({})
        return "provider-challenge"
    }
}

/** Fixture: the adjacent provider module declares this general service's exact challenge method as a proof. */
export class MetaSubscriptionService {
    challenge(_query: object): string { return "provider-challenge" }
}
