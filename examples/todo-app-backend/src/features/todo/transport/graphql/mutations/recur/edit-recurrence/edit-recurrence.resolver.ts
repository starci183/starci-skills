import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    EditRecurrenceCommand,
} from "@modules/domain/recur/index"
import type {
    EditRecurrenceCommandResult,
} from "@modules/domain/recur/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    EditRecurrenceInput 
} from "./graphql-types/input"
import {
    EditRecurrenceResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

@Resolver()
/** The fr.recur.edit door: rewrites a rule's cadence/time for future occurrences while already-materialised history stays byte-identical. */
export class EditRecurrenceResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => EditRecurrenceResponse,
      {
          name: "editRecurrence",
          description: TODO_MESSAGES.get("editRecurrence.description"),
      })
    async editRecurrence(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: EditRecurrenceInput,
    ): Promise<EditRecurrenceResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<EditRecurrenceCommand, EditRecurrenceCommandResult>(
            new EditRecurrenceCommand({
                ruleId: input.ruleId,
                actorId,
                frequency: input.frequency,
                n: input.n,
                dayOfMonth: input.dayOfMonth,
                timeZone: input.timeZone,
                time: input.time,
            }),
        )
        return new EditRecurrenceResponse(result.ruleId,
            result.frequency,
            result.timeZone,
            result.time)
    }
}
