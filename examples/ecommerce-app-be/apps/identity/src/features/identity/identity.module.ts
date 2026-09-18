import { Module } from '@nestjs/common';
import { AccountModule } from '../../modules/bussiness/account';
import { SessionModule } from '../../modules/bussiness/session';
import { OrderModule } from '../../modules/integrations/order';
import { PostgresqlPrimaryModule } from '../../modules/platform/databases/postgresql/primary';
import { RedisPrimaryModule } from '../../modules/platform/caches/redis/primary';
import { SignInController } from './transport/http/sign-in.controller';
import { SessionController } from './transport/http/session.controller';
import { AccountController } from './transport/http/account.controller';
import { HealthController } from './transport/http/health.controller';

/**
 * The identity feature - the HTTP transport of the deployable at apps/identity: the auth door,
 * the session surface order verifies against, the account view that reads buyer status through
 * contract.checkout.order-for-identity, and /health. Thin on purpose: the capability modules own
 * the behavior, the platform modules own persistence and cache.
 */
@Module({
  imports: [
    PostgresqlPrimaryModule,
    RedisPrimaryModule,
    AccountModule,
    SessionModule,
    OrderModule,
  ],
  controllers: [SignInController, SessionController, AccountController, HealthController],
})
export class IdentityModule {}
