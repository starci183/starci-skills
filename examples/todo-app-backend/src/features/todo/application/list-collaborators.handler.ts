import { QueryHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ListCollaboratorsResult } from "./list-collaborators.contracts"
import { ListCollaboratorsQuery } from "./list-collaborators.query"

@QueryHandler(ListCollaboratorsQuery)
/** Lists the invitations on a task with their live statuses for its owner or a bound collaborator; a stranger sees nothing. */
export class ListCollaboratorsHandler extends ICQRSHandler<ListCollaboratorsQuery, ListCollaboratorsResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(query: ListCollaboratorsQuery): Promise<ListCollaboratorsResult> {
        const { request, principal } = query.params
        const views = await this.invitations.listFor({
            actorId: principal.id,
            taskId: request.taskId,
            at: this.clock.now(),
        })
        return {
            collaborators: views.map((view) => ({
                invitationId: view.id,
                email: view.email,
                role: view.role,
                status: view.status,
            })),
        }
    }
}
