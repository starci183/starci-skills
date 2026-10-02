import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { HttpSecurityOptions } from "./http-security.options"
import type { WebhookSignatureService } from "./webhook-signature.service"

/** Token of the options of the http-security capability. */
export const HTTP_SECURITY_OPTIONS: unique symbol = Symbol("platform.http-security.options")

/** Token of the WebhookSignatureService, the proof of a signed webhook. */
export const WEBHOOK_SIGNATURE: unique symbol = Symbol("platform.http-security.webhook-signature")

/** Injects the WebhookSignatureService. Parameter type: WebhookSignatureService. */
export const InjectWebhookSignature = (): TypedParameterDecorator<WebhookSignatureService> =>
    injector<WebhookSignatureService>(WEBHOOK_SIGNATURE)

/** Injects the options of the http-security capability. Parameter type: HttpSecurityOptions. */
export const InjectHttpSecurityOptions = (): TypedParameterDecorator<HttpSecurityOptions> =>
    injector<HttpSecurityOptions>(HTTP_SECURITY_OPTIONS)
