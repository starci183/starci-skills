import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    EndRecurrenceCommand 
} from "@modules/bussiness/recur/end-recurrence.command"
import type {
    EndRecurrenceCommandResult 
} from "@modules/bussiness/recur/end-recurrence.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    EndRecurrenceInput 
} from "./graphql-types/input"
import {
    EndRecurrenceResponse 
} from "./graphql-types/response"

@Resolver()
/** The fr.recur.end door: ends a rule at a date - occurrences on-or-after it orphan, earlier history is preserved. */
export class EndRecurrenceResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => EndRecurrenceResponse,
      {
          name: "endRecurrence",
          description: "fr.recur.end-rule: stop a rule the caller owns from generating any occurrence dated after the given day.",
      })
    async endRecurrence(
    @Context("req") req: GraphqlRequestLike,
    @Args("input") input: EndRecurrenceInput,
    ): Promise<EndRecurrenceResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<EndRecurrenceCommand, EndRecurrenceCommandResult>(
            new EndRecurrenceCommand({
                ruleId: input.ruleId, actorId, endedAt: input.endedAt 
            }),
        )
        return new EndRecurrenceResponse(result.ruleId,
            result.endedAt,
            result.orphanedCount)
    }
}
