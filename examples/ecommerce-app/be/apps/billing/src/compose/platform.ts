import type { DynamicModule } from "@nestjs/common"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES } from "@modules/domain/identity"
import { INVOICE_ERROR_KINDS, INVOICE_MESSAGES } from "@modules/domain/invoice"
import { IDENTITY_API_ERROR_KINDS, IDENTITY_API_MESSAGES } from "@modules/integrations/identity-api"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES } from "@modules/platform/event-bus"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES } from "@modules/platform/http"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { IdsModule } from "@modules/platform/ids"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES } from "@modules/platform/probes"
import type { BillingAppOptions } from "../billing.options"

/** The shared runtime, error catalog and edge policy of the billing API. */
export const platformModules = (options: BillingAppOptions): Array<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    I18nModule.register({
        isGlobal: true,
        bundles: [
            ERRORS_MESSAGES,
            HTTP_MESSAGES,
            HTTP_SECURITY_MESSAGES,
            PROBES_MESSAGES,
            IDENTITY_API_MESSAGES,
            IDENTITY_MESSAGES,
            EVENT_BUS_MESSAGES,
            INVOICE_MESSAGES,
        ],
    }),
    ErrorsModule.register({
        isGlobal: true,
        kinds: [
            CONFIG_ERROR_KINDS,
            DATABASE_ERROR_KINDS,
            HTTP_ERROR_KINDS,
            HTTP_SECURITY_ERROR_KINDS,
            PROBES_ERROR_KINDS,
            IDENTITY_API_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
            EVENT_BUS_ERROR_KINDS,
            INVOICE_ERROR_KINDS,
        ],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
]
