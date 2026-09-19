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
    InviteCommand, InviteCommandResult 
} from "./invite.command"

/**
 * fr.share.invite composes br.share.role.permissions (email/role validation) and br.share.invite.expiry
 * (the fourteen-day window bound at creation). No event.share.* record exists under this feature's
 * event/** family, so - unlike task's create/complete/delete handlers - nothing is published on the
 * PlatformEventBus here; see the final report for this gap.
 */
@Injectable()
@CommandHandler(InviteCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class InviteHandler extends AbstractCommandHandler<InviteCommand, InviteCommandResult> {
    constructor(
    private readonly invitationService: InvitationService,
    ) {
        super()
    }

    protected override async process(command: InviteCommand): Promise<InviteCommandResult> {
        const { params } = command
        const record = await this.invitationService.invite(params.ownerId,
            params.taskId,
            params.email,
            params.role)
        return {
            invitationId: record.id, taskId: record.taskId, email: record.email, role: record.role, status: record.status 
        }
    }
}
