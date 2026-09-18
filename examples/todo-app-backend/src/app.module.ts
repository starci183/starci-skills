import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/platform/config';
import { PlatformEventsModule } from './modules/platform/events';
import { PostgresqlPrimaryModule } from './modules/platform/databases/postgresql/primary';
import { SessionModule } from './modules/bussiness/session';
import { TaskModule } from './modules/bussiness/task';
import { ShareModule } from './modules/bussiness/share';
import { TodoGraphqlModule } from './features/todo/graphql/graphql.module';
import { HealthModule } from './features/todo/http/health/health.module';

/**
 * Composition only, under nivo's shape: capability modules (`bussiness/session`, `bussiness/task`) and
 * the one owned database module are registered here; the GraphQL transport (`TodoGraphqlModule`) and the
 * one surviving HTTP door (`HealthModule`) are the only feature-level composition. `ConfigModule`,
 * `PlatformEventsModule` and `SessionModule` are registered globally: `AppConfigService` and
 * `PlatformEventBus` are genuinely app-wide (every capability and integration needs one or the other),
 * and `SessionService` is needed by five separate GraphQL action modules for the same
 * `x-session-token` -> actor lookup (see `session-context.ts`'s comment) - each capability module that
 * used to import them explicitly (`keycloak.module.ts`, `primary.module.ts`, `task.module.ts`,
 * `session.module.ts`) now relies on that global registration instead. Nothing else here needs to be
 * global, since `@nestjs/cqrs`'s `CqrsModule` and the primary database's own `TypeOrmCoreModule` are
 * already app-wide by the vendor's own design.
 */
@Module({
  imports: [
    ConfigModule.register({ isGlobal: true }),
    PlatformEventsModule.register({ isGlobal: true }),
    PostgresqlPrimaryModule.register(),
    SessionModule.register({ isGlobal: true }),
    TaskModule.register(),
    ShareModule.register(),
    TodoGraphqlModule,
    HealthModule.register(),
  ],
})
export class AppModule {}
