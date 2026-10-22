import type { DynamicModule } from "@nestjs/common"
import { ACCOUNT_ERROR_KINDS, ACCOUNT_MESSAGES } from "@modules/domain/account"
import { IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES } from "@modules/domain/identity"
import { SESSION_ERROR_KINDS, SESSION_MESSAGES } from "@modules/domain/session"
import { CACHE_ERROR_KINDS, CACHE_MESSAGES } from "@modules/integrations/cache"
import { KEYCLOAK_ERROR_KINDS, KEYCLOAK_MESSAGES } from "@modules/integrations/keycloak"
import { KEYCLOAK_ADMIN_ERROR_KINDS, KEYCLOAK_ADMIN_MESSAGES } from "@modules/integrations/keycloak-admin"
import { ORDER_API_ERROR_KINDS, ORDER_API_MESSAGES } from "@modules/integrations/order-api"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES } from "@modules/platform/http"
import { HTTP_SECURITY_ERROR_KINDS, HTTP_SECURITY_MESSAGES } from "@modules/platform/http-security"
import { IdsModule } from "@modules/platform/ids"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES } from "@modules/platform/probes"

/** Registers identity's shared infrastructure, translations and error catalogue. */
export function foundationModules(): Array<DynamicModule> {
    return [
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
                CACHE_MESSAGES,
                KEYCLOAK_MESSAGES,
                KEYCLOAK_ADMIN_MESSAGES,
                ORDER_API_MESSAGES,
                ACCOUNT_MESSAGES,
                SESSION_MESSAGES,
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
                CACHE_ERROR_KINDS,
                KEYCLOAK_ERROR_KINDS,
                KEYCLOAK_ADMIN_ERROR_KINDS,
                ORDER_API_ERROR_KINDS,
                ACCOUNT_ERROR_KINDS,
                SESSION_ERROR_KINDS,
                IDENTITY_ERROR_KINDS,
            ],
        }),
        CqrsModule.register({ isGlobal: true }),
    ]
}
