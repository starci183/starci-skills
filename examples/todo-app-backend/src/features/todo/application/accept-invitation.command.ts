import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AcceptInvitationRequest, AcceptInvitationResult } from "./accept-invitation.contracts"

/** Asks to accept an invitation addressed to the caller. */
export class AcceptInvitationCommand extends Command<AcceptInvitationResult> {
    constructor(readonly params: ExecuteParams<AcceptInvitationRequest>) {
        super()
    }
}
