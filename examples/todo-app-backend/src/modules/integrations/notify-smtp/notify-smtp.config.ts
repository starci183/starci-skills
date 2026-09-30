import type { EnvSource } from "@modules/platform/config"
import type { NotifySmtpOptions } from "./notify-smtp.options"

/** Reads the notify-smtp options: the host, the port and the sender have no default; the two silences are tunables. */
export const parseNotifySmtpConfig = (env: EnvSource): NotifySmtpOptions => ({
    host: env.string("SMTP_HOST"),
    port: env.int("SMTP_PORT"),
    from: env.string("SMTP_FROM"),
    connectTimeoutMs: env.duration("SMTP_CONNECT_TIMEOUT", 5_000),
    commandTimeoutMs: env.duration("SMTP_COMMAND_TIMEOUT", 10_000),
})
