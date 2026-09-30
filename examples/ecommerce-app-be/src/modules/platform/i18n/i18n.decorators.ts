import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { I18nOptions } from "./i18n.options"
import type { MessageCatalog, RequestLocale } from "./i18n.port"

/** Token of the options of the i18n capability; its configurable module provides them under this token. */
export const I18N_OPTIONS: unique symbol = Symbol("platform.i18n.options")

/** Token of the MessageCatalog port. */
export const MESSAGE_CATALOG: unique symbol = Symbol("platform.i18n.message-catalog")

/** Token of the RequestLocale port. */
export const REQUEST_LOCALE: unique symbol = Symbol("platform.i18n.request-locale")

/** Injects the options of the i18n capability. Parameter type: I18nOptions. */
export const InjectI18nOptions = (): TypedParameterDecorator<I18nOptions> => injector<I18nOptions>(I18N_OPTIONS)

/** Injects the MessageCatalog port. Parameter type: MessageCatalog. */
export const InjectMessageCatalog = (): TypedParameterDecorator<MessageCatalog> =>
    injector<MessageCatalog>(MESSAGE_CATALOG)

/** Injects the RequestLocale port. Parameter type: RequestLocale. */
export const InjectRequestLocale = (): TypedParameterDecorator<RequestLocale> => injector<RequestLocale>(REQUEST_LOCALE)
