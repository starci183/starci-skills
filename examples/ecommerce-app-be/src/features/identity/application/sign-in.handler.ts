import { CommandHandler } from "@nestjs/cqrs"
import { AccountService } from "@modules/domain/account"
import { SessionService } from "@modules/domain/session"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { SignInResult } from "./sign-in.contracts"
import { SignInCommand } from "./sign-in.command"

@CommandHandler(SignInCommand)
/** Checks the credentials and starts a session; a wrong email and a wrong password are the same refusal. */
export class SignInHandler extends ICQRSHandler<SignInCommand, SignInResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountService,
        private readonly sessions: SessionService,
    ) {
        super(logger)
    }

    protected override async process(command: SignInCommand): Promise<SignInResult> {
        const { email, password } = command.params.request
        const verified = await this.accounts.verifyCredentials({ email, password })
        if (verified.kind === "refused") return verified
        return ok(await this.sessions.issue({ personId: verified.value.personId }))
    }
}
