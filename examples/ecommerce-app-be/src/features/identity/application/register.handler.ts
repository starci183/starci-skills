import { CommandHandler } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { AccountService } from "@modules/domain/account"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectIdentityEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { RegisterResult } from "./register.contracts"
import { RegisterCommand } from "./register.command"

@CommandHandler(RegisterCommand)
/** Registers a person in one transaction; a taken email is a refusal, not an error. */
export class RegisterHandler extends ICQRSHandler<RegisterCommand, RegisterResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectIdentityEntityManager() private readonly entityManager: EntityManager,
        private readonly accounts: AccountService,
    ) {
        super(logger)
    }

    protected override async process(command: RegisterCommand): Promise<RegisterResult> {
        const { email, password } = command.params.request
        return this.entityManager.transaction((manager) => this.accounts.register({ manager, email, password }))
    }
}
