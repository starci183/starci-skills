import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { UploadError } from "@modules/domain/upload"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { CreateUploadIntentCommand } from "../../application/create-upload-intent.command"
import { toCreateUploadIntentRequest, toCreateUploadIntentType } from "./create-upload-intent.mapper"
import { CreateUploadIntentInput } from "./dto/create-upload-intent.input"
import { CreateUploadIntentType } from "./dto/create-upload-intent.type"

@Resolver()
/** GraphQL door of createUploadIntent: the control plane of the presigned upload. */
export class CreateUploadIntentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Opens a pending upload and answers the presigned request the client sends the bytes with. */
    @Mutation(() => CreateUploadIntentType, {
        name: "createUploadIntent",
        description: "Open an upload intent; the answer is the presigned request that stores the bytes.",
    })
    async createUploadIntent(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: CreateUploadIntentInput,
    ): Promise<CreateUploadIntentType> {
        const outcome = await this.commandBus.execute(
            new CreateUploadIntentCommand({ request: toCreateUploadIntentRequest(input), principal }),
        )
        return toCreateUploadIntentType(unwrapOutcome(outcome, UploadError))
    }
}
