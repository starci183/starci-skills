import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "@modules/platform/config/identity/config.module"
import {
    PostgresqlPrimaryModule 
} from "@modules/platform/databases/postgresql/identity/primary.module"
import {
    RedisPrimaryModule 
} from "@modules/platform/caches/redis/primary/redis.module"
import {
    AccountModule 
} from "@modules/bussiness/account/account.module"
import {
    SessionModule 
} from "@modules/bussiness/session/session.module"
import {
    OrderModule 
} from "@modules/integrations/order/order.module"
import {
    IdentityModule 
} from "@features/identity/identity.module"
import {
    IdentityGraphqlModule 
} from "@features/identity/graphql/graphql.module"

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
 * transport for the user-facing API (features/identity/graphql). Every capability and platform
 * module is registered `isGlobal: true` HERE - whether a capability is app-wide is a fact about
 * this application, so the root declares it and the modules never declare it about themselves.
 * That is what lets the feature module mount its doors without importing a single capability:
 * AppConfigService, the primary EntityManager, RedisPrimaryClient, AccountService,
 * SessionService and OrderApiClient all resolve app-wide.
 */
export class AppModule {}
