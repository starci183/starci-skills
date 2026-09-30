import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SignInRequest, SignInResult } from "./sign-in.contracts"

/** Asks to sign a person in with an email and a password; the door is public, so there is no principal. */
export class SignInCommand extends Command<SignInResult> {
    constructor(readonly params: PublicExecuteParams<SignInRequest>) {
        super()
    }
}
