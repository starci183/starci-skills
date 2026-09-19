import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    InvitationService 
} from "./invitation.service"
import {
    RevokeCollaboratorCommand, RevokeCollaboratorCommandResult 
} from "./revoke-collaborator.command"

/** fr.share.revoke composes br.share.revoke.on-read: the write that flips the row to revoked and, in the
 * same call, deletes the CollaboratorCache entry so the very next mayComplete already refuses - no sweep
 * involved. */
@Injectable()
@CommandHandler(RevokeCollaboratorCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class RevokeCollaboratorHandler extends AbstractCommandHandler<RevokeCollaboratorCommand, RevokeCollaboratorCommandResult> {
    constructor(
    private readonly invitationService: InvitationService,
    ) {
        super()
    }

    protected override async process(command: RevokeCollaboratorCommand): Promise<RevokeCollaboratorCommandResult> {
        const { params } = command
        const record = await this.invitationService.revoke(params.ownerId,
            params.invitationId)
        return {
            invitationId: record.id, status: record.status 
        }
    }
}
