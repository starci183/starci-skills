import {
    Injectable 
} from "@nestjs/common"
import {
    QueryHandler 
} from "@nestjs/cqrs"
import {
    AbstractQueryHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    InvitationService 
} from "./invitation.service"
import {
    CollaboratorSummaryResult, ListCollaboratorsQuery, ListCollaboratorsQueryResult 
} from "./list-collaborators.query"

/** fr.share.list: the owner or a bound collaborator sees every row's live status; a stranger sees
 * nothing (InvitationService.listFor returns an empty array either way). */
@Injectable()
@QueryHandler(ListCollaboratorsQuery)
/** Decorated CQRS query handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class ListCollaboratorsHandler extends AbstractQueryHandler<ListCollaboratorsQuery, ListCollaboratorsQueryResult> {
    constructor(
    private readonly invitationService: InvitationService,
    ) {
        super()
    }

    protected override async process(query: ListCollaboratorsQuery): Promise<ListCollaboratorsQueryResult> {
        const records = await this.invitationService.listFor(query.params.actorId,
            query.params.taskId)
        const collaborators: Array<CollaboratorSummaryResult> = records.map(record => ({
            invitationId: record.id,
            email: record.email,
            role: record.role,
            status: record.status,
        }))
        return {
            collaborators 
        }
    }
}
