import {
    Args, Context, Query, Resolver
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ListCollaboratorsQuery,
} from "@modules/domain/share/index"
import type {
    ListCollaboratorsQueryResult,
} from "@modules/domain/share/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    CollaboratorResponse 
} from "./graphql-types/response"
import {
    CollaboratorsRequest
} from "./graphql-types/request"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

/** fr.share.list's GraphQL query. Dispatches onto the QueryBus, matching task's own split of writes
 * (CommandBus) and reads (QueryBus). */
@Resolver()
/** The fr.share.collaborators door: the invitations attached to a task - readable by its owner or a bound collaborator. */
export class CollaboratorsResolver {
    constructor(
    private readonly queryBus: QueryBus,
    private readonly sessionService: SessionService,
    ) {}

  @Query(() => [CollaboratorResponse],
      {
          name: "collaborators", description: TODO_MESSAGES.get("collaborators.description") 
      })
    async collaborators(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: CollaboratorsRequest,
    ): Promise<Array<CollaboratorResponse>> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<ListCollaboratorsQuery, ListCollaboratorsQueryResult>(
            new ListCollaboratorsQuery({
                actorId, taskId: request.taskId
            }),
        )
        return result.collaborators.map(c => new CollaboratorResponse(c.invitationId,
            c.email,
            c.role,
            c.status))
    }
}
