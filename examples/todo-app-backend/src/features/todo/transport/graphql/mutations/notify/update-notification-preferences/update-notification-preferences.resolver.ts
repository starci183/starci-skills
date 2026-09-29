import {
    Args, Context, Mutation, Resolver 
} from "@nestjs/graphql"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    UpdateNotificationPreferencesCommand,
} from "@modules/domain/notify/index"
import type {
    UpdateNotificationPreferencesCommandResult,
} from "@modules/domain/notify/index"

import {
    SessionService,
} from "@modules/domain/session/index"

import {
    actorIdFromRequest,
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    UpdateNotificationPreferencesInput 
} from "./graphql-types/input"
import {
    UpdateNotificationPreferencesResponse 
} from "./graphql-types/response"
import {
    TODO_MESSAGES 
} from "../../../../../messages/index"

@Resolver()
/** The fr.notify.preferences.update door: writes the caller's channel subscription state and optional digest window - honored by the next admission. */
export class UpdateNotificationPreferencesResolver {
    constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
    ) {}

  @Mutation(() => UpdateNotificationPreferencesResponse,
      {
          name: "updateNotificationPreferences",
          description: TODO_MESSAGES.get("updateNotificationPreferences.description"),
      })
    async updateNotificationPreferences(
    @Context("req") req: GraphqlRequestLike,
    @Args("request") input: UpdateNotificationPreferencesInput,
    ): Promise<UpdateNotificationPreferencesResponse> {
        const actorId = await actorIdFromRequest(req,
            this.sessionService)
        const result = await this.commandBus.execute<UpdateNotificationPreferencesCommand, UpdateNotificationPreferencesCommandResult>(
            new UpdateNotificationPreferencesCommand({
                actorId,
                channel: input.channel,
                unsubscribed: input.unsubscribed,
                digestWindowMinutes: input.digestWindowMinutes,
            }),
        )
        return new UpdateNotificationPreferencesResponse(result.channel,
            result.unsubscribed,
            result.digestWindowMinutes)
    }
}
