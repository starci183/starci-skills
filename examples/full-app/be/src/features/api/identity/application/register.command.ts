import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RegisterRequest, RegisterResult } from "./register.contracts"

/** Asks to register a visitor as a person. */
export class RegisterCommand extends Command<RegisterResult> {
    constructor(readonly params: PublicExecuteParams<RegisterRequest>) {
        super()
    }
}
