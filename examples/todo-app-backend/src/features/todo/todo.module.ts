import {
    Module
} from "@nestjs/common"
import {
    TodoGraphqlModule
} from "./transport/graphql/todo-graphql.module"
import {
    TodoHttpModule
} from "./transport/http/todo-http.module"

/** The todo feature owns its GraphQL and HTTP transport registrations. */
@Module({
    imports: [
        TodoGraphqlModule,
        TodoHttpModule,
    ],
})
/** Public Nest module for the todo feature's GraphQL and HTTP doors. */
export class TodoModule {}
