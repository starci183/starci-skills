import {
    Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    RequestErasureCommand 
} from "@modules/bussiness/audit/request-erasure.command"
import type {
    RequestErasureCommandResult 
} from "@modules/bussiness/audit/request-erasure.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    RequestErasureResponse 
} from "./graphql-types/response"

/** fr.audit.erasure.request: the caller's own personId, taken from `x-session-token`, is the only
 * subject a person may ever request erasure for - there is no operator-initiated erasure in this
 * example (see gap.audit.operator-role). */
@Resolver()
/** The fr.audit.erasure.request door: opens the caller's erasure request and verifies it in the same call - returns the requestId the completion mutation later takes. */
export class RequestErasureResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => RequestErasureResponse,
      {
          name: "requestErasure", description: "Request that everything identifying the caller be erased from the audit log." 
      })
    async requestErasure(@Context("req") req: GraphqlRequestLike): Promise<RequestErasureResponse> {
        const personId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<RequestErasureCommand, RequestErasureCommandResult>(
            new RequestErasureCommand({
                personId 
            }),
        )
        return new RequestErasureResponse(result.requestId,
            result.state)
    }
}
