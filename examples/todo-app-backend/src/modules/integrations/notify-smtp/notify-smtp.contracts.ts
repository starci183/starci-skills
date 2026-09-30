/** One rendered message handed to the mail host. */
export interface NotifySmtpMessageParams {
    /** The recipient address. */
    readonly to: string
    /** The subject line, plain text. */
    readonly subject: string
    /** The body, plain text. */
    readonly body: string
}

/** One answer of the mail host: its three-digit code and the text of every line of the reply. */
export interface SmtpReply {
    /** The reply code. */
    readonly code: number
    /** The text of the reply, one line per line of the reply. */
    readonly text: string
}
