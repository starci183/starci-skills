/** Options of the notify-smtp integration. */
export interface NotifySmtpOptions {
    /** The SMTP submission host. */
    readonly host: string
    /** The SMTP submission port. */
    readonly port: number
    /** The address every message is sent from. */
    readonly from: string
    /** How long opening the connection may stay silent, in milliseconds. */
    readonly connectTimeoutMs: number
    /** How long the host may stay silent while a command is answered, in milliseconds. */
    readonly commandTimeoutMs: number
}
