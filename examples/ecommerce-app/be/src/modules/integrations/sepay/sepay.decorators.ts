import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { WebhookProviderOptions } from "@modules/platform/http-security"

/** Token of the SePay notifier's signing options. */
export const SEPAY_OPTIONS: unique symbol = Symbol("integrations.sepay.options")

/** Injects the SePay notifier's signing options. Parameter type: WebhookProviderOptions. */
export const InjectSepayOptions = (): TypedParameterDecorator<WebhookProviderOptions> =>
    injector<WebhookProviderOptions>(SEPAY_OPTIONS)
