import { CommandHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InviteCommand } from "./invite.command"
import type { InviteResult } from "./invite.contracts"

@CommandHandler(InviteCommand)
/** Invites a collaborator onto a task the caller owns; an unknown task and somebody else's task are refused the same way. */
export class InviteHandler extends ICQRSHandler<InviteCommand, InviteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: InviteCommand): Promise<InviteResult> {
        const { request, principal } = command.params
        return this.invitations.invite({
            ownerId: principal.id,
            taskId: request.taskId,
            email: request.email,
            role: request.role,
        })
    }
}
