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
} from "@modules/platform/exceptions/errors/abstract"

import {
    QUERY_MODULES 
} from "./queries"
import {
    MUTATION_MODULES 
} from "./mutations"

interface GraphqlContextShape { req: unknown; res: unknown }

/**
 * Code-first Apollo GraphQL API for the order service + all operation modules - the same
 * pattern todo-app-backend's `features/todo/graphql/graphql.module.ts` uses (`ApolloDriver`,
 * `autoSchemaFile: true`, `sortSchema: true`, one `context` closure exposing `req`/`res`).
 * `formatError` reads an `AbstractException`'s stable `code` back out of Apollo's error envelope
 * onto `extensions.code`, minus the `_EXCEPTION` transport suffix, and spreads the exception's
 * metadata beside it, so a GraphQL error carries the same machine-readable business code (and
 * refusal detail - `reason`, `productId`, `requested`, `available`) the REST error body used to
 * carry - clients keyed on `CHECKOUT_REFUSAL`/`SESSION_INVALID`/etc. still see that code, just
 * relocated.
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
                    const metadata = {
                        ...(original.metadata ?? {
                        }) 
                    }
                    delete metadata.originalError
                    return {
                        ...formatted, message: original.message, extensions: {
                            ...formatted.extensions, code: original.code.replace(/_EXCEPTION$/,
                                ""), ...metadata 
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
/** Composition for the checkout GraphQL API: code-first Apollo plus every query and mutation module; the formatError closure above is what carries AbstractException codes and refusal metadata onto extensions. */
export class CheckoutGraphqlModule {}
