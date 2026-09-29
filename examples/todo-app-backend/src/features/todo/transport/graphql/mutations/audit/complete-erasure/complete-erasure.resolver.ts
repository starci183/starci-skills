import {
    Args, Context, Mutation, Resolver
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    CompleteErasureCommand,
} from "@modules/domain/audit/index"
import type {
    CompleteErasureCommandResult,
} from "@modules/domain/audit/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    CompleteErasureResponse 
} from "./graphql-types/response"
import {
    CompleteErasureRequest
} from "./graphql-types/request"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

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
          name: "completeErasure", description: TODO_MESSAGES.get("completeErasure.description") 
      })
    async completeErasure(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") request: CompleteErasureRequest,
    ): Promise<CompleteErasureResponse> {
        const callerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<CompleteErasureCommand, CompleteErasureCommandResult>(
            new CompleteErasureCommand({
                requestId: request.requestId, callerId
            }),
        )
        return new CompleteErasureResponse(result.requestId,
            result.state)
    }
}
