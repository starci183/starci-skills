import { CommandHandler } from "@nestjs/cqrs"
import { AccountService } from "@modules/domain/account"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RegisterResult } from "./register.contracts"
import { RegisterCommand } from "./register.command"

@CommandHandler(RegisterCommand)
/** Registers a person; a taken email is a refusal, not an error. */
export class RegisterHandler extends ICQRSHandler<RegisterCommand, RegisterResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: AccountService,
    ) {
        super(logger)
    }

    protected override process(command: RegisterCommand): Promise<RegisterResult> {
        const { email, password } = command.params.request
        return this.accounts.register({ email, password })
    }
}
