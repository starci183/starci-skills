import { QueryHandler } from "@nestjs/cqrs"
import { InvitationService } from "@modules/domain/share"
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
        private readonly invitations: InvitationService,
    ) {
        super(logger)
    }

    protected override async process(query: ListCollaboratorsQuery): Promise<ListCollaboratorsResult> {
        return this.invitations.listFor({ actorId: query.params.principal.id, taskId: query.params.request.taskId })
    }
}
