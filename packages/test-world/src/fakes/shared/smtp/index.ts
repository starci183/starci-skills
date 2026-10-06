/** The mail host at the network edge: `smtpFake()` declares a real SMTP server; the app's SMTP client only points its host and port here. */
import type { FakeBridge, FakeClient, FakeDefinition, FakeInstance, FakeStartContext } from "../../framework/contracts"
import { createBaseClient } from "../../framework/http-fake"
import { FailureQueue, FakeControlRejected, RequestLog, runBaseControl } from "../../framework/failures"
import { SmtpServer } from "../../framework/smtp-server"
import type { SentMail } from "../../framework/smtp-server"

export type { SentMail } from "../../framework/smtp-server"
export type { MailAttachment } from "../../framework/mime"

/** The handle a spec holds at `world.fake.<name>` for the mail fake. */
export interface SmtpFakeClient extends FakeClient {
    /** The decoded messages accepted since the last reset, oldest first. */
    mails(): Promise<ReadonlyArray<SentMail>>
}

/**
 * Declares the SMTP fake. `values`: `{ host, port }`. `failNext({ status: 4xx|5xx })` answers the next RCPT TO with that code
 * (`match: { method: "MAIL" | "DATA" }` picks another verb); `failNext({ timeout: true })` leaves the conversation silent.
 */
export const smtpFake = (): FakeDefinition<SmtpFakeClient> => ({
    kind: "smtp",
    client: (bridge: FakeBridge): SmtpFakeClient => ({
        ...createBaseClient(bridge),
        mails: () => bridge.call<ReadonlyArray<SentMail>>("mails"),
    }),
    start: async (_context: FakeStartContext): Promise<FakeInstance> => {
        const log = new RequestLog()
        const failures = new FailureQueue()
        const server = new SmtpServer({ log, failures })
        const port = await server.listen()
        const reset = (): Promise<void> => {
            log.clear()
            failures.clear()
            server.clear()
            return Promise.resolve()
        }
        return {
            url: "",
            host: "127.0.0.1",
            port,
            values: { host: "127.0.0.1", port: String(port) },
            endpoints: {},
            control: async (action, body) => {
                const base = await runBaseControl(action, body, { failures, log, reset })
                if (base.handled) return base.result
                if (action === "mails") return server.mails()
                throw new FakeControlRejected(404, `unknown control action "${action}"`)
            },
            reset,
            close: () => server.close(),
        }
    },
})
