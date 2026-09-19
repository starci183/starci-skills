import {
    Args,
    Mutation,
    Resolver,
} from "@nestjs/graphql"
import {
    UseGuards,
    UseInterceptors,
} from "@nestjs/common"
import {
    GraphQLLocale,
} from "@modules/api/apollo/server/decorators/locale.decorators"
import {
    GraphQLSuccessMessage,
    GraphQLTransformInterceptor,
} from "@modules/api/apollo/server/interceptors/graphql-transform.interceptor"
import {
    KeycloakAuthGraphQLGuard,
} from "@modules/integrations/keycloak/guards/keycloak-auth-graphql.guard"
import {
    KeycloakGraphQLUser,
} from "@modules/integrations/keycloak/keycloak.decorators"
import {
    ThrottlerConfig,
} from "@modules/platform/throttler/enums/throttler-config"
import {
    UseThrottler,
} from "@modules/platform/throttler/throttler.decorators"
import {
    Locale,
} from "@modules/databases/postgresql/primary/enums/locale"
import type {
    UserEntity,
} from "@modules/databases/postgresql/primary/entities/user.entity"
import {
    ExampleCreateItemRequest,
} from "./graphql-types/request"
import {
    ExampleCreateItemResponse,
    ExampleItemEntity,
} from "./graphql-types/response"
import {
    ExampleCreateItemService,
} from "./example.service"

@Resolver()
/** GraphQL entry for the synthetic exampleCreateItem mutation. */
export class ExampleCreateItemResolver {
    constructor(
        private readonly exampleCreateItemService: ExampleCreateItemService,
    ) {}

    /**
     * Creates or returns the requested example item for the authenticated caller.
     *
     * @param user - Authenticated user from the host auth guard.
     * @param request - Item id to create or return.
     * @param locale - Request locale for success messaging.
     * @returns The example item row.
     */
    @UseThrottler(ThrottlerConfig.Medium)
    @UseGuards(KeycloakAuthGraphQLGuard)
    @GraphQLSuccessMessage({
        [Locale.En]: "Example item created successfully",
        [Locale.Vi]: "Example item created successfully",
    })
    @UseInterceptors(GraphQLTransformInterceptor)
    @Mutation(
        () => ExampleCreateItemResponse,
        {
            name: "exampleCreateItem",
            description: "Create or return a synthetic example item (idempotent per user × item).",
        },
    )
    async execute(
        @KeycloakGraphQLUser()
            user: UserEntity,
        @Args(
            "request",
            {
                description: "Example item id to create or return.",
            },
        )
            request: ExampleCreateItemRequest,
        @GraphQLLocale()
            locale: Locale,
    ): Promise<ExampleItemEntity> {
        return this.exampleCreateItemService.execute({
            request,
            user,
            locale,
        })
    }
}
