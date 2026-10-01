/**
 * A real SMTP server on a loopback port (RFC 5321 subset used by nodemailer-like clients): greeting, EHLO/HELO with `AUTH PLAIN
 * LOGIN` accepted, MAIL FROM, RCPT TO, DATA with dot-unstuffing, RSET, NOOP, QUIT. STARTTLS is not offered. Accepted messages
 * are MIME-decoded; an armed failure answers the next MAIL FROM / RCPT TO / DATA with a 4xx/5xx or leaves the conversation silent.
 */
import { createServer } from "node:net"
import type { Server, Socket } from "node:net"
import type { FailureQueue, RecordingHandle, RequestLog } from "./failures"
import { closeServer, listenLoopback, trackSockets } from "./http-kit"
import { parseMessage } from "./mime"
import type { MailAttachment } from "./mime"

const CRLF = "\r\n"

/** One accepted, decoded message. */
export interface SentMail {
    /** ISO time of acceptance. */
    readonly at: string
    /** The SMTP envelope (MAIL FROM / RCPT TO), which may differ from the headers (Bcc). */
    readonly envelope: { readonly from: string; readonly to: ReadonlyArray<string> }
    /** The From header address. */
    readonly from: string
    /** The To header addresses. */
    readonly to: ReadonlyArray<string>
    readonly cc: ReadonlyArray<string>
    /** The decoded Subject (RFC 2047 B and Q words). */
    readonly subject: string
    /** The decoded text/plain body, "" when none. */
    readonly text: string
    /** The decoded text/html body, "" when none. */
    readonly html: string
    readonly attachments: ReadonlyArray<MailAttachment>
    /** Decoded headers by lower-case name. */
    readonly headers: Readonly<Record<string, string>>
    /** The raw message as received (dot-unstuffed). */
    readonly raw: string
}

/** What the server shares with its fake. */
export interface SmtpServerDeps {
    readonly log: RequestLog
    readonly failures: FailureQueue
}

const addressOf = (argument: string): string => /<([^>]*)>/.exec(argument)?.[1] ?? argument.replace(/^(FROM|TO):/i, "").trim()

/** The SMTP server of the mail fake. */
export class SmtpServer {
    private readonly accepted: Array<SentMail> = []
    private readonly server: Server
    private readonly sockets: Set<Socket>
    private port = 0

    constructor(private readonly deps: SmtpServerDeps) {
        this.server = createServer((socket) => this.converse(socket))
        this.sockets = trackSockets(this.server)
    }

    /** Binds a loopback port and answers it. */
    async listen(): Promise<number> {
        this.port = await listenLoopback(this.server)
        return this.port
    }

    /** Stops the server and drops every conversation, silent ones included. */
    close(): Promise<void> {
        return closeServer(this.server, this.sockets)
    }

    /** The messages accepted so far, oldest first. */
    mails(): ReadonlyArray<SentMail> {
        return [...this.accepted]
    }

    /** Forgets accepted mails. */
    clear(): void {
        this.accepted.length = 0
    }

    private converse(socket: Socket): void {
        socket.setEncoding("utf8")
        let buffer = ""
        let from: string | null = null
        let recipients: Array<string> = []
        let data: Array<string> | null = null
        let dataEntry: RecordingHandle | null = null
        let auth: "plain" | "login-user" | "login-pass" | null = null
        let silent = false
        let entry: RecordingHandle | null = null

        const reply = (text: string): void => {
            if (silent) return
            entry?.setStatus(Number.parseInt(text.slice(0, 3), 10) || 0)
            socket.write(`${text}${CRLF}`)
        }

        /** True when an armed failure took over the answer (silence or a reply code). */
        const failed = (verb: string, argument: string): boolean => {
            const failure = this.deps.failures.takeInbound(verb, argument, "RCPT")
            if (failure === null) return false
            if (failure.timeout === true) {
                silent = true
                return true
            }
            if (failure.status !== undefined) {
                reply(`${failure.status} ${failure.status >= 500 ? "5.0.0" : "4.0.0"} injected failure`)
                return true
            }
            return false
        }

        const finishData = (lines: Array<string>): void => {
            const raw = lines.join(CRLF)
            const parsed = parseMessage(raw)
            this.accepted.push({
                at: new Date().toISOString(),
                envelope: { from: from ?? "", to: recipients },
                from: parsed.from,
                to: parsed.to,
                cc: parsed.cc,
                subject: parsed.subject,
                text: parsed.text,
                html: parsed.html,
                attachments: parsed.attachments,
                headers: parsed.headers,
                raw,
            })
            dataEntry?.setBody(raw)
            entry = dataEntry
            data = null
            from = null
            recipients = []
            reply("250 2.0.0 OK queued")
        }

        const command = (line: string): void => {
            const verb = (line.split(" ")[0] ?? "").toUpperCase()
            const argument = line.slice(verb.length).trim()
            entry = this.deps.log.begin({ method: verb, path: argument, headers: {}, body: "" })
            if (silent) return
            if (verb === "EHLO") {
                socket.write(`250-fake-smtp${CRLF}250-8BITMIME${CRLF}250 AUTH PLAIN LOGIN${CRLF}`)
                entry.setStatus(250)
            } else if (verb === "HELO") reply("250 fake-smtp")
            else if (verb === "AUTH") {
                const [mechanism, initial] = argument.split(/\s+/)
                if (mechanism?.toUpperCase() === "PLAIN") {
                    if (initial !== undefined) reply("235 2.7.0 Authentication successful")
                    else {
                        auth = "plain"
                        reply("334 ")
                    }
                } else if (mechanism?.toUpperCase() === "LOGIN") {
                    auth = "login-user"
                    reply("334 VXNlcm5hbWU6")
                } else reply("504 5.5.4 Unrecognized authentication type")
            } else if (verb === "MAIL") {
                if (failed(verb, argument)) return
                from = addressOf(argument)
                recipients = []
                reply("250 2.1.0 OK")
            } else if (verb === "RCPT") {
                if (failed(verb, argument)) return
                recipients.push(addressOf(argument))
                reply("250 2.1.5 OK")
            } else if (verb === "DATA") {
                if (failed(verb, argument)) return
                if (from === null || recipients.length === 0) {
                    reply("503 5.5.1 Need MAIL and RCPT first")
                    return
                }
                data = []
                dataEntry = entry
                reply("354 End data with <CR><LF>.<CR><LF>")
            } else if (verb === "RSET") {
                from = null
                recipients = []
                reply("250 2.0.0 OK")
            } else if (verb === "NOOP") reply("250 2.0.0 OK")
            else if (verb === "QUIT") {
                reply("221 2.0.0 Bye")
                socket.end()
            } else reply("502 5.5.2 Command not recognized")
        }

        const authLine = (): void => {
            if (auth === "login-user") {
                auth = "login-pass"
                reply("334 UGFzc3dvcmQ6")
                return
            }
            auth = null
            reply("235 2.7.0 Authentication successful")
        }

        const line = (text: string): void => {
            if (data !== null) {
                if (text === ".") finishData(data)
                else data.push(text.startsWith("..") ? text.slice(1) : text)
            } else if (auth !== null) authLine()
            else command(text)
        }

        socket.on("data", (chunk: string) => {
            buffer += chunk
            for (let end = buffer.indexOf(CRLF); end >= 0; end = buffer.indexOf(CRLF)) {
                const next = buffer.slice(0, end)
                buffer = buffer.slice(end + CRLF.length)
                line(next)
            }
        })
        socket.on("error", () => socket.destroy())
        socket.write(`220 fake-smtp ESMTP ready${CRLF}`)
    }
}
