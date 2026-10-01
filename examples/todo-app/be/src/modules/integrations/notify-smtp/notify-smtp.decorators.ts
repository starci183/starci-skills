import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { NotifySmtpClient } from "./notify-smtp.client"
import type { NotifySmtpOptions } from "./notify-smtp.options"

/** Token of the notify-smtp client. */
export const NOTIFY_SMTP_CLIENT: unique symbol = Symbol("integrations.notify-smtp.client")

/** Token of the notify-smtp options, so a spec can provide them. */
export const NOTIFY_SMTP_OPTIONS: unique symbol = Symbol("integrations.notify-smtp.options")

/** Injects the options of the notify-smtp integration. Parameter type: NotifySmtpOptions. */
export const InjectNotifySmtpOptions = (): TypedParameterDecorator<NotifySmtpOptions> =>
    injector<NotifySmtpOptions>(NOTIFY_SMTP_OPTIONS)

/** Injects the notify-smtp client. Parameter type: NotifySmtpClient. */
export const InjectNotifySmtp = (): TypedParameterDecorator<NotifySmtpClient> =>
    injector<NotifySmtpClient>(NOTIFY_SMTP_CLIENT)
