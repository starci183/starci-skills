import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    MakeRecurringCommand 
} from "@modules/bussiness/recur/make-recurring.command"
import type {
    MakeRecurringCommandResult 
} from "@modules/bussiness/recur/make-recurring.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    MakeRecurringInput 
} from "./graphql-types/input"
import {
    MakeRecurringResponse 
} from "./graphql-types/response"

@Resolver()
/** The fr.recur.make door: turns a title into a recurrence rule - cadence, time zone, local fire time and start date. */
export class MakeRecurringResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => MakeRecurringResponse,
      {
          name: "makeRecurring",
          description: "fr.recur.make-recurring: create a recurrence rule owned by the caller.",
      })
    async makeRecurring(
    @Context("req") req: GraphqlRequestLike,
    @Args("input") input: MakeRecurringInput,
    ): Promise<MakeRecurringResponse> {
        const ownerId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<MakeRecurringCommand, MakeRecurringCommandResult>(
            new MakeRecurringCommand({
                ownerId,
                title: input.title,
                frequency: input.frequency,
                n: input.n ?? null,
                dayOfMonth: input.dayOfMonth ?? null,
                timeZone: input.timeZone,
                time: input.time,
                startDate: input.startDate,
            }),
        )
        return new MakeRecurringResponse(result.ruleId,
            result.title,
            result.frequency,
            result.timeZone,
            result.time,
            result.startDate)
    }
}
