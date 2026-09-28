import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "ecommerce-app-be/modules/platform/config/identity"
import {
    PostgresqlPrimaryModule 
} from "ecommerce-app-be/modules/platform/databases/postgresql/identity"
import {
    RedisPrimaryModule 
} from "ecommerce-app-be/modules/platform/caches/redis/primary"
import {
    AccountModule 
} from "ecommerce-app-be/modules/domain/account"
import {
    SessionModule 
} from "ecommerce-app-be/modules/domain/session"
import {
    OrderModule 
} from "ecommerce-app-be/modules/integrations/order"
import {
    IdentityModule 
} from "ecommerce-app-be/features/identity"
import {
    IdentityGraphqlModule 
} from "ecommerce-app-be/features/identity"

@Module({
    imports: [
        ConfigModule.register({
            isGlobal: true 
        }),
        PostgresqlPrimaryModule.register({
            isGlobal: true 
        }),
        RedisPrimaryModule.register({
            isGlobal: true 
        }),
        AccountModule.register({
            isGlobal: true 
        }),
        SessionModule.register({
            isGlobal: true 
        }),
        OrderModule.register({
            isGlobal: true 
        }),
        IdentityModule,
        IdentityGraphqlModule,
    ],
})
/**
 * Composition only, in nivo's monorepo shape: each deployable under apps/<service> has its own
 * root module, and this one wires the identity service - the platform modules (config, the
 * shared Postgres for persons, Redis for sessions), the capability modules (account, session),
 * the HTTP client that consumes contract.checkout.order-for-identity (integrations/order), the
 * feature that exposes the justified HTTP doors (features/identity) and the canonical GraphQL
 * transport for the user-facing API (features/identity/transport/graphql). Every capability and platform
 * module is registered `isGlobal: true` HERE - whether a capability is app-wide is a fact about
 * this application, so the root declares it and the modules never declare it about themselves.
 * That is what lets the feature module mount its doors without importing a single capability:
 * AppConfigService, the primary EntityManager, RedisPrimaryClient, AccountService,
 * SessionService and OrderApiClient all resolve app-wide.
 */
export class AppModule {}
