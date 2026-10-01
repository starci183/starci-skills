import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SignOutRequest, SignOutResult } from "./sign-out.contracts"

/** Asks to end the session behind a token; the door is public, so there is no principal. */
export class SignOutCommand extends Command<SignOutResult> {
    constructor(readonly params: PublicExecuteParams<SignOutRequest>) {
        super()
    }
}
