import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    NotifySmtpPort 
} from "../notify-smtp.contracts"
import {
    FakeNotifySmtpClient 
} from "./fake-notify-smtp.client"

const message = {
    to: "person@example.com", subject: "Welcome", body: "hello" 
}

/** The fake is the NotifySmtpPort every notify spec substitutes, so its recording and per-address
 * failure classification are pinned here - a drifted fake would silently void those specs. */
describe("FakeNotifySmtpClient",
    () => {
        let moduleRef: TestingModule
        let fake: FakeNotifySmtpClient
        let port: NotifySmtpPort

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [FakeNotifySmtpClient,
                    {
                        provide: NotifySmtpPort, useExisting: FakeNotifySmtpClient 
                    }],
            }).compile()
            fake = moduleRef.get(FakeNotifySmtpClient)
            port = moduleRef.get(NotifySmtpPort)
        })

        afterEach(() => moduleRef.close())

        it("is the instance the port token resolves to",
            () => {
                expect(port).toBe(fake)
            })

        it("records every accepted message",
            async () => {
                await fake.send(message)
                await fake.send({
                    ...message, to: "other@example.com" 
                })
                expect(fake.sent).toEqual([message,
                    {
                        ...message, to: "other@example.com" 
                    }])
            })

        it("rejects an address marked transient with NOTIFY_SMTP_TRANSIENT_FAILURE and records nothing",
            async () => {
                fake.failTransientFor("person@example.com")
                await expect(fake.send(message)).rejects.toThrow(
                    expect.objectContaining({
                        code: "NOTIFY_SMTP_TRANSIENT_FAILURE_EXCEPTION" 
                    }),
                )
                expect(fake.sent).toEqual([])
            })

        it("rejects an address marked permanent with NOTIFY_SMTP_PERMANENT_REJECTION",
            async () => {
                fake.failPermanentFor("person@example.com")
                await expect(fake.send(message)).rejects.toThrow(
                    expect.objectContaining({
                        code: "NOTIFY_SMTP_PERMANENT_REJECTION_EXCEPTION" 
                    }),
                )
            })

        it("treats a permanent mark as stronger than a transient one on the same address",
            async () => {
                fake.failTransientFor("person@example.com")
                fake.failPermanentFor("person@example.com")
                await expect(fake.send(message)).rejects.toThrow(
                    expect.objectContaining({
                        code: "NOTIFY_SMTP_PERMANENT_REJECTION_EXCEPTION" 
                    }),
                )
            })

        it("clearFailuresFor lets a later send to the same address through",
            async () => {
                fake.failPermanentFor("person@example.com")
                fake.clearFailuresFor("person@example.com")
                await expect(fake.send(message)).resolves.toBeUndefined()
                expect(fake.sent).toEqual([message])
            })
    })
