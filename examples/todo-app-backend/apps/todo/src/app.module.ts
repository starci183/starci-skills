import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule,
} from "@modules/platform/config/index"
import {
    PlatformEventsModule,
} from "@modules/platform/events/index"
import {
    PostgresqlPrimaryModule,
} from "@modules/platform/databases/postgresql/primary/index"
import {
    KeycloakModule,
} from "@modules/integrations/keycloak/index"
import {
    SepayModule,
} from "@modules/integrations/sepay/index"
import {
    NotifySmtpModule,
} from "@modules/integrations/notify-smtp/index"
import {
    NotifyQueueModule,
} from "@modules/integrations/notify-queue/index"
import {
    UploadModule,
} from "@modules/integrations/upload/index"
import {
    ObservabilityModule,
} from "@modules/platform/observability/index"
import {
    SessionModule,
} from "@modules/domain/session/index"
import {
    TaskModule,
} from "@modules/domain/task/index"
import {
    ShareModule,
} from "@modules/domain/share/index"
import {
    RecurModule,
} from "@modules/domain/recur/index"
import {
    NotifyModule,
} from "@modules/domain/notify/index"
import {
    AuditModule,
} from "@modules/domain/audit/index"
import {
    PlanModule,
} from "@modules/domain/plan/index"
import {
    TodoModule
} from "@features/todo/index"

/**
 * Composition only, under nivo's shape: capability modules (`domain/session`, `domain/task`) and
 * the one owned database module are registered here; the GraphQL transport (`TodoGraphqlModule`) and the
 * one surviving HTTP door (`HealthModule`) are the only feature-level composition. `ConfigModule`,
 * `PlatformEventsModule` and `SessionModule` are registered globally: `AppConfigService` and
 * `PlatformEventBus` are genuinely app-wide (every capability and integration needs one or the other),
 * and `SessionService` is needed by five separate GraphQL action modules for the same
 * `Authorization: Bearer <token>` -> actor lookup (see `session-actor.adapter.ts`'s comment) - each capability module that
 * used to import them explicitly (`keycloak.module.ts`, `primary.module.ts`, `task.module.ts`,
 * `session.module.ts`) now relies on that global registration instead. Nothing else here needs to be
 * global, since `@nestjs/cqrs`'s `CqrsModule` and the primary database's own `TypeOrmCoreModule` are
 * already app-wide by the vendor's own design.
 */
@Module({
    imports: [
        ConfigModule.register({
            isGlobal: true 
        }),
        PlatformEventsModule.register({
            isGlobal: true 
        }),
        PostgresqlPrimaryModule.register({
            isGlobal: true 
        }),
        SessionModule.register({
            isGlobal: true 
        }),
        KeycloakModule.register({
            isGlobal: true 
        }),
        SepayModule.register({
            isGlobal: true 
        }),
        NotifySmtpModule.register({
            isGlobal: true 
        }),
        NotifyQueueModule.register({
            isGlobal: true 
        }),
        UploadModule.register({
            isGlobal: true 
        }),
        ObservabilityModule.register({
            isGlobal: true 
        }),
        TaskModule.register(),
        ShareModule.register(),
        RecurModule.register(),
        NotifyModule.register(),
        AuditModule.register(),
        PlanModule.register(),
        TodoModule,
    ],
})
/** Root composition module: registers every owned capability and global integration once. */
export class AppModule {}
