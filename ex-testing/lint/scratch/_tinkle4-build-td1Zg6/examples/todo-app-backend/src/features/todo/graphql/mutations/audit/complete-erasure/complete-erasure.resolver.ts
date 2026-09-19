import {
    Args, Context, ID, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    CompleteErasureCommand 
} from "@modules/bussiness/audit/complete-erasure.command"
import type {
    CompleteErasureCommandResult 
} from "@modules/bussiness/audit/complete-erasure.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    CompleteErasureResponse 
} from "./graphql-types/response"

/** fr.audit.erasure.complete. In the real journey a worker picks up a verified request; this mutation
 * is that pickup exposed for the caller who requested it to trigger directly, since this example has no
 * background worker infrastructure. AuditErasureService.execute still refuses if the caller does not
 * match the request's own subject. */
@Resolver()
/** The fr.audit.erasure.complete door: finishes the caller's verified erasure request - the key is crypto-shredded and the request row anonymized in the same call. */
export class CompleteErasureResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => CompleteErasureResponse,
      {
          name: "completeErasure", description: "Complete a verified erasure request: destroy the subject key, then confirm and log completion." 
      })
    async completeErasure(
    @Context("req") req: GraphqlRequestLike,
    @Args("requestId",
        {
            type: () => ID 
        }) requestId: string,
    ): Promise<CompleteErasureResponse> {
        const callerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<CompleteErasureCommand, CompleteErasureCommandResult>(
            new CompleteErasureCommand({
                requestId, callerId 
            }),
        )
        return new CompleteErasureResponse(result.requestId,
            result.state)
    }
}
