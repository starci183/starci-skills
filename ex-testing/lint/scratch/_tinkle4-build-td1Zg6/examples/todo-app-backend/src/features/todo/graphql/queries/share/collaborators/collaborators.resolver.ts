import {
    Args, Context, ID, Query, Resolver 
} from "@nestjs/graphql"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ListCollaboratorsQuery 
} from "@modules/bussiness/share/list-collaborators.query"
import type {
    ListCollaboratorsQueryResult 
} from "@modules/bussiness/share/list-collaborators.query"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    CollaboratorResponse 
} from "./graphql-types/response"

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
          name: "collaborators", description: "List a task’s collaborators, visible to the owner and to bound collaborators." 
      })
    async collaborators(
    @Context("req") req: GraphqlRequestLike,
    @Args("taskId",
        {
            type: () => ID 
        }) taskId: string,
    ): Promise<Array<CollaboratorResponse>> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.queryBus.execute<ListCollaboratorsQuery, ListCollaboratorsQueryResult>(
            new ListCollaboratorsQuery({
                actorId, taskId 
            }),
        )
        return result.collaborators.map(c => new CollaboratorResponse(c.invitationId,
            c.email,
            c.role,
            c.status))
    }
}
