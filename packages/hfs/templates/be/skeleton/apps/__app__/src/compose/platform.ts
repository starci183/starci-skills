import type { DynamicModule } from "@nestjs/common"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES } from "@modules/domain/identity"
import { NOTE_ERROR_KINDS, noteEntities, noteMigrations } from "@modules/domain/note"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { RetryModule } from "@modules/platform/retry"
import type { {{appPascal}}Options } from "../{{app}}.options"

/**
 * The platform area of the {{app}} app: every platform capability, registered once and app-wide. A composition
 * group holds one area's module list and nothing else (no logic, no environment read); `app.module.ts` spreads it
 * into its imports.
 */
export const platformModules = (options: {{appPascal}}Options): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    RetryModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [ERRORS_MESSAGES, HTTP_SECURITY_MESSAGES, IDENTITY_MESSAGES],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            CONFIG_ERROR_KINDS,
            DATABASE_ERROR_KINDS,
            HTTP_SECURITY_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            NOTE_ERROR_KINDS,
        ],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
    DatabaseModule.register({
        isGlobal: true,
        connections: [{ ...options.database, entities: noteEntities, migrations: noteMigrations }],
    }),
]
