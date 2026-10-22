import { CommandHandler } from "@nestjs/cqrs"
import { AccountService } from "@modules/domain/account"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { SignInResult } from "./sign-in.contracts"
import { SignInCommand } from "./sign-in.command"

@CommandHandler(SignInCommand)
/** Checks the credentials and starts a session; a wrong email and a wrong password are the same refusal. */
export class SignInHandler extends ICQRSHandler<SignInCommand, SignInResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountService,
    ) {
        super(logger)
    }

    protected override process(command: SignInCommand): Promise<SignInResult> {
        return this.accounts.signIn({ email: command.params.request.email, password: command.params.request.password })
    }
}
