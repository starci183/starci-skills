import { CommandHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SignInCommand } from "./sign-in.command"
import type { SignInResult } from "./sign-in.contracts"

@CommandHandler(SignInCommand)
/** Signs a person in through the session service; the provider check, the session and its audit line live there. */
export class SignInHandler extends ICQRSHandler<SignInCommand, SignInResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: SignInCommand): Promise<SignInResult> {
        return this.sessions.signIn(command.params.request)
    }
}
