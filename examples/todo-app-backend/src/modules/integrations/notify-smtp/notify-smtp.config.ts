import {
    AppConfigService,
} from "@modules/platform/config/index"

/** The SMTP submission settings: host, port and the from address. */
export interface NotifySmtpConfig {
    readonly host: string
    readonly port: number
    readonly fromAddress: string
}

/** Reads the notify-smtp settings through the platform config reader on every access, so a value changed in the environment is never cached here. */
export const notifySmtpConfig = (source: AppConfigService): NotifySmtpConfig => ({
    get host(): string {
        return source.getSmtpHost()
    },
    get port(): number {
        return source.getSmtpPort()
    },
    get fromAddress(): string {
        return source.getSmtpFromAddress()
    },
})
