import { CommandHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AcceptInvitationCommand } from "./accept-invitation.command"
import type { AcceptInvitationResult } from "./accept-invitation.contracts"

@CommandHandler(AcceptInvitationCommand)
/** Binds the caller to a pending invitation addressed to their email; the role is active from the same commit. */
export class AcceptInvitationHandler extends ICQRSHandler<AcceptInvitationCommand, AcceptInvitationResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
        const { request, principal } = command.params
        return this.invitations.accept({ actorId: principal.id, invitationId: request.invitationId, email: request.email })
    }
}
