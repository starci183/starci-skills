import type { DynamicModule } from "@nestjs/common"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES } from "@modules/domain/identity"
import { CART_ERROR_KINDS } from "@modules/domain/cart"
import { ORDER_ERROR_KINDS, ORDER_MESSAGES } from "@modules/domain/order"
import { IDENTITY_API, IDENTITY_API_ERROR_KINDS, IDENTITY_API_MESSAGES } from "@modules/integrations/identity-api"
import { RECEIPT_STORAGE_ERROR_KINDS, RECEIPT_STORAGE_MESSAGES } from "@modules/integrations/receipt-storage"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseProbe } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { EVENT_BUS_ERROR_KINDS, EVENT_BUS_MESSAGES, EVENT_TRANSPORT } from "@modules/platform/event-bus"
import { GraphqlModule } from "@modules/platform/graphql"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES, HttpSecurityModule } from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { IdsModule } from "@modules/platform/ids"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES } from "@modules/platform/jobs"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { RealtimeModule } from "@modules/platform/realtime"
import { RetryModule } from "@modules/platform/retry"
import type { OrderAppOptions } from "../order.options"

/**
 * The platform area of the order api: the request-side platform capabilities (clock, ids, logging, the copy and error
 * catalogs, CQRS, HTTP security, the HTTP client, realtime, probes and the GraphQL server), registered once and
 * app-wide. A composition group holds one area's module list and nothing else; `app.module.ts` spreads it.
 */
export const platformModules = (options: OrderAppOptions): Array<DynamicModule> => [
    RetryModule.register({ isGlobal: true }),
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
            ORDER_MESSAGES,
            RECEIPT_STORAGE_MESSAGES,
            EVENT_BUS_MESSAGES,
            JOBS_MESSAGES,
            IDENTITY_MESSAGES,
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
            CART_ERROR_KINDS,
            ORDER_ERROR_KINDS,
            RECEIPT_STORAGE_ERROR_KINDS,
            EVENT_BUS_ERROR_KINDS,
            JOBS_ERROR_KINDS,
            IDENTITY_ERROR_KINDS,
        ],
    }),
    CqrsModule.register({ isGlobal: true }),
    HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
    HttpModule.register({ isGlobal: true }),
    RealtimeModule.register({ isGlobal: true }),
    ProbesModule.register({
        isGlobal: true,
        service: "order",
        probes: [DatabaseProbe, IDENTITY_API, EVENT_TRANSPORT],
    }),
    GraphqlModule.register({ isGlobal: true }),
]
