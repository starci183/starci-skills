import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { InviteRequest, InviteResult } from "./invite.contracts"

/** Asks to invite a collaborator onto one of the caller's own tasks. */
export class InviteCommand extends Command<InviteResult> {
    constructor(readonly params: ExecuteParams<InviteRequest>) {
        super()
    }
}
