import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NotifySmtpClient } from "./notify-smtp.client"
import { MODULE_OPTIONS_TOKEN } from "./notify-smtp.module-definition"
import type { NotifySmtpOptions } from "./notify-smtp.options"

/** Token of the notify-smtp client. */
export const NOTIFY_SMTP_CLIENT: unique symbol = Symbol("integrations.notify-smtp.client")

/** Injects the options of the notify-smtp integration. Parameter type: NotifySmtpOptions. */
export const InjectNotifySmtpOptions = (): TypedParameterDecorator<NotifySmtpOptions> =>
    injector<NotifySmtpOptions>(MODULE_OPTIONS_TOKEN)

/** Injects the notify-smtp client. Parameter type: NotifySmtpClient. */
export const InjectNotifySmtp = (): TypedParameterDecorator<NotifySmtpClient> =>
    injector<NotifySmtpClient>(NOTIFY_SMTP_CLIENT)
