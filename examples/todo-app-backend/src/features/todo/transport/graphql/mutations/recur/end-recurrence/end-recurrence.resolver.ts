import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    EndRecurrenceCommand,
} from "@modules/domain/recur/index"
import type {
    EndRecurrenceCommandResult,
} from "@modules/domain/recur/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    EndRecurrenceInput 
} from "./graphql-types/input"
import {
    EndRecurrenceResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

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
          description: TODO_MESSAGES.get("endRecurrence.description"),
      })
    async endRecurrence(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: EndRecurrenceInput,
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
