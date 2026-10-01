import { CommandHandler } from "@nestjs/cqrs"
import { SessionService } from "@modules/domain/identity"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SignOutCommand } from "./sign-out.command"
import type { SignOutResult } from "./sign-out.contracts"

@CommandHandler(SignOutCommand)
/** Ends the session behind the presented token through the session service. */
export class SignOutHandler extends ICQRSHandler<SignOutCommand, SignOutResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: SignOutCommand): Promise<SignOutResult> {
        return this.sessions.signOut(command.params.request)
    }
}
