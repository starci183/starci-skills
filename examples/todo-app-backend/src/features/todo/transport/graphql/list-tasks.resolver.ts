import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListTasksQuery } from "../../application/list-tasks.query"
import { ListTasksType } from "./dto/list-tasks.type"
import { toListTasksType } from "./list-tasks.mapper"

@Resolver()
/** GraphQL door of tasks. */
export class ListTasksResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The tasks owned by the caller. */
    @Query(() => [ListTasksType], { name: "tasks", description: "List the tasks owned by the caller." })
    async tasks(@CurrentPrincipal() principal: Principal): Promise<Array<ListTasksType>> {
        const result = await this.queryBus.execute(new ListTasksQuery({ request: {}, principal }))
        return toListTasksType(result)
    }
}
