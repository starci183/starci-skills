import {
    Module 
} from "@nestjs/common"
import {
    ApolloDriver 
} from "@nestjs/apollo"
import type {
    ApolloDriverConfig 
} from "@nestjs/apollo"
import {
    GraphQLModule as NestGraphQLModule 
} from "@nestjs/graphql"
import {
    GraphQLFormattedError 
} from "graphql"
import {
    AbstractException 
} from "@modules/shared/exceptions/errors/abstract"

import {
    QUERY_MODULES 
} from "./queries"
import {
    MUTATION_MODULES 
} from "./mutations"

interface GraphqlContextShape { req: unknown; res: unknown }

/**
 * Code-first Apollo GraphQL API + all operation modules - the same pattern nivo's own
 * `features/expert/graphql/graphql.module.ts` uses (`ApolloDriver`, `autoSchemaFile: true`,
 * `sortSchema: true`, one `context` closure exposing `req`/`res`). `formatError` reads an
 * `AbstractException`'s stable `code` back out of Apollo's error envelope onto `extensions.code`, so a
 * GraphQL error carries the same machine-readable code every REST error response used to carry in its
 * body minus the `_EXCEPTION` transport suffix - clients keyed on `TASK_FORBIDDEN`/`SESSION_EXPIRED`/etc. still see that code, just relocated.
 */
@Module({
    imports: [
        NestGraphQLModule.forRoot<ApolloDriverConfig>({
            driver: ApolloDriver,
            autoSchemaFile: true,
            sortSchema: true,
            path: "/graphql",
            playground: false,
            introspection: true,
            context: (ctx: GraphqlContextShape) => ({
                req: ctx.req, res: ctx.res 
            }),
            formatError: (formatted: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
                const original = typeof error === "object" && error !== null && "originalError" in error
                    ? error.originalError
                    : undefined
                if (original instanceof AbstractException) {
                    return {
                        ...formatted, message: original.message, extensions: {
                            ...formatted.extensions, code: original.code.replace(/_EXCEPTION$/,
                                "") 
                        } 
                    }
                }
                return formatted
            },
        }),
        ...QUERY_MODULES,
        ...MUTATION_MODULES,
    ],
})
/** Composition for the todo GraphQL API: code-first Apollo plus every query and mutation module; the formatError closure above is what carries AbstractException codes onto extensions.code. */
export class TodoGraphqlModule {}
