import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/platform/config';
import { PostgresqlPrimaryModule } from './modules/platform/databases/postgresql/primary';
import { SessionModule } from './modules/bussiness/session';
import { TaskModule } from './modules/bussiness/task';
import { TodoGraphqlModule } from './features/todo/graphql/graphql.module';
import { HealthModule } from './features/todo/http/health/health.module';

/**
 * Composition only, under nivo's shape: capability modules (`bussiness/session`, `bussiness/task`) and
 * the one owned database module are registered here; the GraphQL transport (`TodoGraphqlModule`) and the
 * one surviving HTTP door (`HealthModule`) are the only feature-level composition. `SessionModule` is
 * registered globally because five separate GraphQL action modules need `SessionService` for the same
 * `x-session-token` -> actor lookup (see `session-context.ts`'s comment); nothing else here needs to be
 * global, since `@nestjs/cqrs`'s `CqrsModule` and the primary database's own `TypeOrmCoreModule` are
 * already app-wide by the vendor's own design.
 */
@Module({
  imports: [
    ConfigModule,
    PostgresqlPrimaryModule.register(),
    SessionModule.register({ isGlobal: true }),
    TaskModule.register(),
    TodoGraphqlModule,
    HealthModule.register(),
  ],
})
export class AppModule {}
