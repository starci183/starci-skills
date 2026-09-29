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
    DomainError 
} from "ecommerce-app-be/modules/platform/errors"

import {
    isRecord
} from "ecommerce-app-be/modules/platform/primitives"

import {
    QUERY_MODULES 
} from "./queries"
import {
    MUTATION_MODULES 
} from "./mutations"

interface GraphqlContextShape { req: unknown; res: unknown }

/**
 * Code-first Apollo GraphQL API for the identity service + all operation modules - the same
 * pattern todo-app-backend's `features/todo/graphql/graphql.module.ts` uses (`ApolloDriver`,
 * `autoSchemaFile: true`, `sortSchema: true`, one `context` closure exposing `req`/`res`).
 * `formatError` reads an `DomainError`'s stable `code` back out of Apollo's error envelope
 * onto `extensions.code`, minus the `_EXCEPTION` transport suffix, and spreads the exception's
 * metadata beside it, so a GraphQL error carries the same machine-readable business code (and
 * refusal detail) the REST error body used to carry - clients keyed on
 * `INVALID_CREDENTIALS`/`EMAIL_TAKEN`/etc. still see that code, just relocated.
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
                const original = isRecord(error)
                    ? error.originalError
                    : undefined
                if (original instanceof DomainError) {
                    return {
                        ...formatted, message: original.message, extensions: {
                            ...formatted.extensions, code: original.code.replace(/_EXCEPTION$/,
                                ""), ...original.metadata 
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
/** Composition for the identity GraphQL API: code-first Apollo plus every query and mutation module; the formatError closure above is what carries DomainError codes and refusal metadata onto extensions. */
export class IdentityGraphqlModule {}
