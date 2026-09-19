import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    UnsubscribeCommand 
} from "@modules/bussiness/notify/unsubscribe.command"
import type {
    UnsubscribeCommandResult 
} from "@modules/bussiness/notify/unsubscribe.command"

import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    actorIdFromRequest, GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    UnsubscribeInput 
} from "./graphql-types/input"
import {
    UnsubscribeResponse 
} from "./graphql-types/response"

@Resolver()
/** The fr.notify.unsubscribe door: marks the caller's channel unsubscribed so later events are suppressed at admission - before any digest window or transport attempt. */
export class UnsubscribeResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => UnsubscribeResponse,
      {
          name: "unsubscribe", description: "Stop receiving notifications on one channel." 
      })
    async unsubscribe(
    @Context("req") req: GraphqlRequestLike,
    @Args("input") input: UnsubscribeInput,
    ): Promise<UnsubscribeResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<UnsubscribeCommand, UnsubscribeCommandResult>(
            new UnsubscribeCommand({
                actorId, channel: input.channel 
            }),
        )
        return new UnsubscribeResponse(result.channel,
            result.unsubscribed)
    }
}
