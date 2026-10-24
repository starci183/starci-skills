import type { DynamicModule } from "@nestjs/common"
import { BOOKINGS_ERROR_KINDS } from "@modules/domain/bookings"
import { CALENDAR_INBOX_ERROR_KINDS } from "@modules/domain/calendar-inbox"
import { CALENDARS_ERROR_KINDS } from "@modules/domain/calendars"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES } from "@modules/domain/identity"
import { LIVENESS_ERROR_KINDS, LIVENESS_MESSAGES } from "@modules/domain/liveness"
import { RESOURCES_ERROR_KINDS } from "@modules/domain/resources"
import { SUPABASE_ERROR_KINDS } from "@modules/integrations/supabase"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { GraphqlModule } from "@modules/platform/graphql"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule } from "@modules/platform/jobs"
import { LoggingModule } from "@modules/platform/logging"
import { QueueModule } from "@modules/platform/queue"
import { RealtimeModule } from "@modules/platform/realtime"
import type { ApiOptions } from "../api.options"

/**
 * The platform area of the API: every platform capability (the queue, the fenced jobs, the realtime hub and the
 * GraphQL server included), registered once and app-wide. A composition group holds one area's module list and
 * nothing else; `app.module.ts` spreads it into its imports.
 */
export const platformModules = (options: ApiOptions): Array<DynamicModule> => [
    GraphqlModule.register({ isGlobal: true }),
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [ERRORS_MESSAGES, HTTP_SECURITY_MESSAGES, IDENTITY_MESSAGES, JOBS_MESSAGES, LIVENESS_MESSAGES],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            CALENDAR_INBOX_ERROR_KINDS,
            CALENDARS_ERROR_KINDS,
            BOOKINGS_ERROR_KINDS,
            RESOURCES_ERROR_KINDS,
            CONFIG_ERROR_KINDS,
            DATABASE_ERROR_KINDS,
            HTTP_SECURITY_ERROR_KINDS,
            JOBS_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            LIVENESS_ERROR_KINDS,
            SUPABASE_ERROR_KINDS,
        ],
    }),
    CqrsModule.register({ isGlobal: true }),
    RealtimeModule.register({ isGlobal: true }),
    HttpSecurityModule.register({
        isGlobal: true,
        ...options.httpSecurity,
    }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [options.database],
    }),
    QueueModule.register({
        isGlobal: true,
        connections: [PRIMARY_ENTITY_MANAGER],
        ...options.queue,
    }),
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        ...options.jobs,
    }),
]
