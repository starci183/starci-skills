import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/platform/config';
import { PostgresqlPrimaryModule } from './modules/platform/databases/postgresql/primary';
import { RedisPrimaryModule } from './modules/platform/caches/redis/primary';
import { AccountModule } from './modules/bussiness/account';
import { SessionModule } from './modules/bussiness/session';
import { OrderModule } from './modules/integrations/order';
import { IdentityModule } from './features/identity/identity.module';

/**
 * Composition only, in nivo's monorepo shape: each deployable under apps/<service> has its own root
 * module, and this one wires the identity service - the platform modules (config, the shared Postgres
 * for persons, Redis for sessions), the capability modules (account, session), the HTTP client that
 * consumes contract.checkout.order-for-identity (integrations/order), and the feature that exposes
 * the transport (features/identity). ConfigModule is @Global so TypeOrmModule.forRootAsync and the
 * Redis client can inject AppConfigService without re-importing it.
 */
@Module({
  imports: [
    ConfigModule,
    PostgresqlPrimaryModule,
    RedisPrimaryModule,
    AccountModule,
    SessionModule,
    OrderModule,
    IdentityModule,
  ],
})
export class AppModule {}
