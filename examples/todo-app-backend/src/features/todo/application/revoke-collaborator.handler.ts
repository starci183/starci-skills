import { CommandHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RevokeCollaboratorCommand } from "./revoke-collaborator.command"
import type { RevokeCollaboratorResult } from "./revoke-collaborator.contracts"

@CommandHandler(RevokeCollaboratorCommand)
/** Revokes an invitation for its owner; access ends with the commit, because the access rule reads the row every time. */
export class RevokeCollaboratorHandler extends ICQRSHandler<RevokeCollaboratorCommand, RevokeCollaboratorResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: RevokeCollaboratorCommand): Promise<RevokeCollaboratorResult> {
        const { request, principal } = command.params
        return this.invitations.revoke({ ownerId: principal.id, invitationId: request.invitationId })
    }
}
