import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/session"
import { UploadError } from "@modules/domain/upload"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { unwrapOutcome } from "@modules/platform/primitives"
import { ListTaskUploadsQuery } from "../../application/list-task-uploads.query"
import { TaskUploadsInput } from "./dto/task-uploads.input"
import { UploadType } from "./dto/upload.type"
import { toTaskUploadsRequest, toTaskUploadsTypes } from "./task-uploads.mapper"

@Resolver()
/** GraphQL door of taskUploads. */
export class TaskUploadsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The uploads attached to a task of the caller. */
    @Query(() => [UploadType], {
        name: "taskUploads",
        description: "List the uploads attached to a task of the caller.",
    })
    async taskUploads(
        @CurrentPrincipal() principal: Principal,
        @Args("request") input: TaskUploadsInput,
    ): Promise<Array<UploadType>> {
        const outcome = await this.queryBus.execute(
            new ListTaskUploadsQuery({ request: toTaskUploadsRequest(input), principal }),
        )
        return toTaskUploadsTypes(unwrapOutcome(outcome, UploadError))
    }
}
