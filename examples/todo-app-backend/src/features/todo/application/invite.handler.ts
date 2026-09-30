import { CommandHandler } from "@nestjs/cqrs"
import { InvitationService, ShareErrorCode } from "@modules/domain/share"
import { TaskService } from "@modules/domain/task"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { InviteCommand } from "./invite.command"
import type { InviteResult } from "./invite.contracts"

@CommandHandler(InviteCommand)
/**
 * Invites a collaborator onto a task the caller owns. The task is read first so nobody can invite onto a task they do
 * not own; an unknown task and somebody else's task are refused the same way.
 */
export class InviteHandler extends ICQRSHandler<InviteCommand, InviteResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly tasks: TaskService,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(command: InviteCommand): Promise<InviteResult> {
        const { request, principal } = command.params
        const task = await this.tasks.find({ id: request.taskId })
        if (!task || task.owner !== principal.id) return refused(ShareErrorCode.Forbidden, { taskId: request.taskId })
        const at = this.clock.now()
        const outcome = await this.entityManager.transaction((manager) =>
            this.invitations.invite({
                manager,
                ownerId: principal.id,
                taskId: task.id,
                email: request.email,
                role: request.role,
                at,
            }),
        )
        if (outcome.kind === "refused") return outcome
        const invitation = outcome.value
        return ok({
            invitationId: invitation.id,
            taskId: invitation.taskId,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
        })
    }
}
