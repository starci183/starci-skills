import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { UploadError } from "@modules/domain/upload"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { DeleteUploadCommand } from "../../application/delete-upload.command"
import { toDeleteUploadRequest, toDeleteUploadType } from "./delete-upload.mapper"
import { DeleteUploadInput } from "./dto/delete-upload.input"
import { DeleteUploadType } from "./dto/delete-upload.type"

@Resolver()
/** GraphQL door of deleteUpload. */
export class DeleteUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Deletes an upload of the caller, its row and its stored bytes. */
    @Mutation(() => DeleteUploadType, { name: "deleteUpload" })
    async deleteUpload(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: DeleteUploadInput,
    ): Promise<DeleteUploadType> {
        const outcome = await this.commandBus.execute(
            new DeleteUploadCommand({ request: toDeleteUploadRequest(input), principal }),
        )
        return toDeleteUploadType(unwrapOutcome(outcome, UploadError))
    }
}
