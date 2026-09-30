import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { UploadError } from "@modules/domain/upload"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { AttachUploadCommand } from "../../application/attach-upload.command"
import { toAttachUploadRequest } from "./attach-upload.mapper"
import { AttachUploadInput } from "./dto/attach-upload.input"
import { UploadType } from "./dto/upload.type"
import { toUploadType } from "./upload.mapper"

@Resolver()
/** GraphQL door of attachUpload. */
export class AttachUploadResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Points a ready upload of the caller at a task of the caller. */
    @Mutation(() => UploadType, { name: "attachUpload" })
    async attachUpload(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AttachUploadInput,
    ): Promise<UploadType> {
        const outcome = await this.commandBus.execute(
            new AttachUploadCommand({ request: toAttachUploadRequest(input), principal }),
        )
        return toUploadType(unwrapOutcome(outcome, UploadError))
    }
}
