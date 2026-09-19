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
    AcceptInvitationCommand, AcceptInvitationCommandResult 
} from "./accept-invitation.command"

/** fr.share.accept composes br.share.invite.expiry (the window guard) and br.share.role.permissions (the
 * accepted role becomes active immediately, through InvitationService binding personId into the
 * synchronous CollaboratorCache in the same call that persists the row). */
@Injectable()
@CommandHandler(AcceptInvitationCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class AcceptInvitationHandler extends AbstractCommandHandler<AcceptInvitationCommand, AcceptInvitationCommandResult> {
    constructor(
    private readonly invitationService: InvitationService,
    ) {
        super()
    }

    protected override async process(command: AcceptInvitationCommand): Promise<AcceptInvitationCommandResult> {
        const { params } = command
        const record = await this.invitationService.accept(params.actorId,
            params.invitationId,
            params.email)
        return {
            invitationId: record.id, role: record.role, status: record.status 
        }
    }
}
