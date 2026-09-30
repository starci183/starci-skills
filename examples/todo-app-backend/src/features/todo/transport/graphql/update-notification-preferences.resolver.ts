import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { NotifyError } from "@modules/domain/notify"
import { CurrentPrincipal } from "@modules/domain/session"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { UpdateNotificationPreferencesCommand } from "../../application/update-notification-preferences.command"
import { UpdateNotificationPreferencesInput } from "./dto/update-notification-preferences.input"
import { UpdateNotificationPreferencesType } from "./dto/update-notification-preferences.type"
import {
    toUpdateNotificationPreferencesRequest,
    toUpdateNotificationPreferencesType,
} from "./update-notification-preferences.mapper"

@Resolver()
/** GraphQL door of updateNotificationPreferences. */
export class UpdateNotificationPreferencesResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Writes the caller's subscription state and optional digest window on one channel; the next admission honors it. */
    @Mutation(() => UpdateNotificationPreferencesType, {
        name: "updateNotificationPreferences",
        description: "Change the digest window and/or unsubscribed flag for one notification channel.",
    })
    async updateNotificationPreferences(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: UpdateNotificationPreferencesInput,
    ): Promise<UpdateNotificationPreferencesType> {
        const outcome = await this.commandBus.execute(
            new UpdateNotificationPreferencesCommand({ request: toUpdateNotificationPreferencesRequest(input), principal }),
        )
        return toUpdateNotificationPreferencesType(unwrapOutcome(outcome, NotifyError))
    }
}
