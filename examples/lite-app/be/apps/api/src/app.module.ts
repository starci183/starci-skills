import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_ADMIN_CLIENT,
    SUPABASE_ERROR_KINDS,
    createSupabaseAccessTokenVerifier,
    createSupabaseAdminClient,
} from "@modules/integrations/supabase"
import { LivenessModule } from "@modules/domain/liveness"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import type { ApiOptions } from "./api.options"
import { RESOURCES_ERROR_KINDS, ResourcesModule } from "@modules/domain/resources"
import { BOOKINGS_ERROR_KINDS, BookingsModule } from "@modules/domain/bookings"
import { CALENDARS_ERROR_KINDS, CalendarsModule } from "@modules/domain/calendars"
import { BookingsHttpModule } from "@features/api/bookings"
import { CalendarHttpModule } from "@features/webhooks/calendar"
import { CalendarInboxModule } from "@modules/domain/calendar-inbox"

@Module({})
/** Composition root of the API: every capability is registered once and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                CalendarInboxModule.register({ isGlobal: true }),
                CalendarHttpModule,
                BookingsHttpModule,
                CalendarsModule.register({ isGlobal: true }),
                BookingsModule.register({ isGlobal: true }),
                ResourcesModule.register({ isGlobal: true }),
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [ERRORS_MESSAGES, HTTP_SECURITY_MESSAGES, IDENTITY_MESSAGES],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CALENDARS_ERROR_KINDS,
                        BOOKINGS_ERROR_KINDS,
                        RESOURCES_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({
                    isGlobal: true,
                    ...options.httpSecurity,
                }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [options.database],
                }),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                LivenessModule.register({ isGlobal: true }),
                SystemHealthHttpModule,
            ],
            providers: [
                {
                    provide: SUPABASE_ADMIN_CLIENT,
                    useValue: createSupabaseAdminClient(options.supabase),
                },
                { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
