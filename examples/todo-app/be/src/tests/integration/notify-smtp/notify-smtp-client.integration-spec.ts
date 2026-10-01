import { randomUUID } from "node:crypto"
import { NOTIFY_SMTP_CLIENT, NotifySmtpErrorCode } from "@modules/integrations/notify-smtp"
import type { NotifySmtpClient } from "@modules/integrations/notify-smtp"
import { NOTIFY_SMTP_CAPABILITY_MODULES } from "@tests/world/test-capabilities.options"
import { useTestWorld } from "@tests/world/use-test-world"

const PERMANENT_REFUSAL = 550
const TRANSIENT_REFUSAL = 451

/**
 * notify-smtp: the real mail client over SMTP against the mail host fake at the network edge, no HTTP door of ours. A message
 * reaches the mail host with its recipient, subject and body intact; a 5xx answer to the
 * recipient is the declared permanent rejection, a 4xx answer is a transient failure, and a mail host that goes silent runs
 * the client into its own deadline as a transient failure.
 */
describe("notify-smtp: mail client (integration)", () => {
    const world = useTestWorld({ modules: NOTIFY_SMTP_CAPABILITY_MODULES })

    const client = (): NotifySmtpClient => world.resolve<NotifySmtpClient>(NOTIFY_SMTP_CLIENT)

    it("delivers a message the mail host accepts with its recipient, subject and body", async () => {
        const to = `mail-${randomUUID()}@e2e.test`
        const subject = `Reminder ${randomUUID()}`
        const body = `Task ${randomUUID()} is done.`

        await client().send({ to, subject, body })

        const mail = await world.waitFor(
            "the mail host accepted the message",
            async () => (await world.fake.smtp.mails()).find((accepted) => accepted.envelope.to.includes(to)) ?? null,
        )
        expect(mail.subject).toBe(subject)
        expect(mail.text).toContain(body)
        expect(mail.from).toBe("todo@e2e.test")
    })

    it("a 5xx answer to the recipient is the declared permanent rejection, a 4xx answer a transient failure", async () => {
        const to = `mail-${randomUUID()}@e2e.test`

        await world.fake.smtp.failNext({ status: PERMANENT_REFUSAL, match: { method: "RCPT" } })
        await expect(client().send({ to, subject: "s", body: "b" })).rejects.toMatchObject({
            code: NotifySmtpErrorCode.PermanentRejection,
        })

        await world.fake.smtp.failNext({ status: TRANSIENT_REFUSAL, match: { method: "RCPT" } })
        await expect(client().send({ to, subject: "s", body: "b" })).rejects.toMatchObject({
            code: NotifySmtpErrorCode.TransientFailure,
        })

        expect((await world.fake.smtp.mails()).filter((accepted) => accepted.envelope.to.includes(to))).toEqual([])
    })

    it("a silent mail host is a transient failure at the client deadline, and the next message goes through", async () => {
        const to = `mail-${randomUUID()}@e2e.test`

        await world.fake.smtp.failNext({ timeout: true, match: { method: "RCPT" } })
        await expect(client().send({ to, subject: "silent", body: "b" })).rejects.toMatchObject({
            code: NotifySmtpErrorCode.TransientFailure,
        })

        await client().send({ to, subject: "after", body: "b" })
        const delivered = await world.waitFor(
            "the message after the silence accepted",
            async () =>
                (await world.fake.smtp.mails()).find(
                    (accepted) => accepted.envelope.to.includes(to) && accepted.subject === "after",
                ) ?? null,
        )
        expect(delivered.subject).toBe("after")
    })
})
