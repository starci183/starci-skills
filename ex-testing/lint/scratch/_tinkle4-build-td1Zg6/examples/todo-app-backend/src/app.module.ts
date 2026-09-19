import {
    Module 
} from "@nestjs/common"
import {
    ConfigModule 
} from "@modules/platform/config/config.module"
import {
    PlatformEventsModule 
} from "@modules/platform/events/events.module"
import {
    PostgresqlPrimaryModule 
} from "@modules/platform/databases/postgresql/primary/primary.module"
import {
    KeycloakModule 
} from "@modules/integrations/keycloak/keycloak.module"
import {
    SepayModule 
} from "@modules/integrations/sepay/sepay.module"
import {
    NotifySmtpModule 
} from "@modules/integrations/notify-smtp/notify-smtp.module"
import {
    NotifyQueueModule 
} from "@modules/integrations/notify-queue/notify-queue.module"
import {
    SessionModule 
} from "@modules/bussiness/session/session.module"
import {
    TaskModule 
} from "@modules/bussiness/task/task.module"
import {
    ShareModule 
} from "@modules/bussiness/share/share.module"
import {
    RecurModule 
} from "@modules/bussiness/recur/recur.module"
import {
    NotifyModule 
} from "@modules/bussiness/notify/notify.module"
import {
    AuditModule 
} from "@modules/bussiness/audit/audit.module"
import {
    PlanModule 
} from "@modules/bussiness/plan/plan.module"
import {
    TodoGraphqlModule 
} from "./features/todo/graphql/graphql.module"
import {
    HealthModule 
} from "./features/todo/http/health/health.module"
import {
    SepayWebhookModule 
} from "./features/todo/http/webhooks/sepay/sepay-webhook.module"

/**
 * Composition only, under nivo's shape: capability modules (`bussiness/session`, `bussiness/task`) and
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
        TaskModule.register(),
        ShareModule.register(),
        RecurModule.register(),
        NotifyModule.register(),
        AuditModule.register(),
        PlanModule.register(),
        TodoGraphqlModule,
        HealthModule.register(),
        SepayWebhookModule.register(),
    ],
})
/** Root composition module: registers every owned capability and global integration once. */
export class AppModule {}
