import { ApolloDriver } from "@nestjs/apollo"
import type { ApolloDriverConfig } from "@nestjs/apollo"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { GraphQLModule as NestGraphQLModule } from "@nestjs/graphql"
import { ERRORS_SERVICE } from "@modules/platform/errors"
import type { ErrorsService } from "@modules/platform/errors"
import { REQUEST_LOCALE } from "@modules/platform/i18n"
import type { RequestLocale } from "@modules/platform/i18n"
import { GRAPHQL_DEPTH_MAX } from "./graphql.contracts"
import type { ConnectionExtra, ConnectionParams, GraphqlContext, GraphqlContextInput } from "./graphql.contracts"
import { graphqlContextOf, rememberAuthorization } from "./graphql-context.mapper"
import { depthLimitRule } from "./graphql-depth.policy"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./graphql.module-definition"
import { localizeErrorsPlugin } from "./localize-errors.mapper"

@Module({})
/** The one code-first Apollo server of the app: schema from the resolvers, the shared error formatter, a depth limit, and subscriptions over graphql-ws authenticated by the Authorization connection param. */
export class GraphqlModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; the feature resolvers join the schema by being providers. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                ...(base.imports ?? []),
                NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
                    driver: ApolloDriver,
                    inject: [ERRORS_SERVICE, REQUEST_LOCALE],
                    useFactory: (errors: ErrorsService, requestLocale: RequestLocale) => ({
                        autoSchemaFile: true,
                        sortSchema: true,
                        path: "/graphql",
                        playground: false,
                        introspection: true,
                        subscriptions: {
                            "graphql-ws": {
                                onConnect: (connection: { connectionParams?: ConnectionParams; extra: ConnectionExtra }): void =>
                                    rememberAuthorization(connection.connectionParams, connection.extra),
                            },
                        },
                        context: (input: GraphqlContextInput): GraphqlContext => graphqlContextOf(input),
                        formatError: errors.formatError,
                        validationRules: [depthLimitRule(GRAPHQL_DEPTH_MAX)],
                        plugins: [localizeErrorsPlugin(errors, requestLocale)],
                    }),
                }),
            ],
        }
    }
}
