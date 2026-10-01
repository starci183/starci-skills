import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { TaskCountsQuery } from "../../application/task-counts.query"
import { TaskCountsType } from "./dto/task-counts.type"
import { toTaskCountsType } from "./task-counts.mapper"

@Resolver()
/** GraphQL door of taskCounts. */
export class TaskCountsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** How many of the caller own tasks are open and complete. */
    @Query(() => TaskCountsType, { name: "taskCounts" })
    async taskCounts(@CurrentPrincipal() principal: Principal): Promise<TaskCountsType> {
        const counts = await this.queryBus.execute(new TaskCountsQuery({ request: {}, principal }))
        return toTaskCountsType(counts)
    }
}
