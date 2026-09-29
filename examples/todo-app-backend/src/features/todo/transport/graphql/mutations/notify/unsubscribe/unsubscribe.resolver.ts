import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    UnsubscribeCommand,
} from "@modules/domain/notify/index"
import type {
    UnsubscribeCommandResult,
} from "@modules/domain/notify/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    UnsubscribeInput 
} from "./graphql-types/input"
import {
    UnsubscribeResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

@Resolver()
/** The fr.notify.unsubscribe door: marks the caller's channel unsubscribed so later events are suppressed at admission - before any digest window or transport attempt. */
export class UnsubscribeResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => UnsubscribeResponse,
      {
          name: "unsubscribe", description: TODO_MESSAGES.get("unsubscribe.description") 
      })
    async unsubscribe(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: UnsubscribeInput,
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
