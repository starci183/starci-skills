import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    NotifySmtpPort 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    createFakeNotifyEntityManager 
} from "./testing/fake-notify-entity-manager"
import {
    FakeNotifySmtpClient 
} from "@modules/integrations/notify-smtp/testing/fake-notify-smtp.client"
import {
    DeliveryService, RETRY_BUDGET 
} from "./delivery.service"

describe("DeliveryService",
    () => {
        let moduleRef: TestingModule
        let smtp: FakeNotifySmtpClient
        let service: DeliveryService

        beforeEach(async () => {
            smtp = new FakeNotifySmtpClient()
            moduleRef = await Test.createTestingModule({
                providers: [
                    DeliveryService,
                    {
                        provide: NotifySmtpPort, useValue: smtp 
                    },
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(DeliveryService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.notify.failure.classified.suppresses-unsubscribed: reaches suppressed before any dispatch attempt, and no attempt is ever made",
            async () => {
                const now = new Date("2026-09-18T06:00:00.000Z")
                const attempt = await service.admit("notif-1",
                    now,
                    true)

                expect(attempt.state).toBe("suppressed")
                expect(attempt.failureClass).toBe("unsubscribed")
                expect(attempt.endedAt).toEqual(now)
                expect(smtp.sent).toHaveLength(0)
            })

        it("sds.notify.delivery-lifecycle t-dispatch/t-deliver: a queued attempt that the transport accepts reaches delivered",
            async () => {
                const now = new Date("2026-09-18T06:10:00.000Z")
                await service.admit("notif-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    false)

                const result = await service.dispatchBatch(["notif-1"],
                    now,
                    {
                        to: "owner@todo.dev", subject: "x", body: "y" 
                    })

                expect(result.delivered).toEqual(["notif-1"])
                expect(smtp.sent).toHaveLength(1)
                const attempt = await service.findById("notif-1")
                expect(attempt?.state).toBe("delivered")
                expect(attempt?.endedAt).toEqual(now)
                expect(attempt?.attempt).toBe(1)
            })

        it("ac.notify.failure.classified.suppresses-bounced-address: a permanent rejection reaches bounced and does not retry",
            async () => {
                smtp.failPermanentFor("rejected@todo.dev")
                await service.admit("notif-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    false)

                const result = await service.dispatchBatch(["notif-1"],
                    new Date("2026-09-18T06:10:00.000Z"),
                    {
                        to: "rejected@todo.dev",
                        subject: "x",
                        body: "y",
                    })

                expect(result.bounced).toEqual(["notif-1"])
                expect(result.retried).toEqual([])
                const attempt = await service.findById("notif-1")
                expect(attempt?.state).toBe("bounced")
                expect(attempt?.failureClass).toBe("permanent-bounce")
                expect(attempt?.endedAt).not.toBeNull()
            })

        it("ac.notify.failure.classified.retries-transient: a transient failure returns to queued with failureClass transient, and a later dispatch can still reach delivered",
            async () => {
                smtp.failTransientFor("flaky@todo.dev")
                await service.admit("notif-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    false)

                const first = await service.dispatchBatch(["notif-1"],
                    new Date("2026-09-18T06:10:00.000Z"),
                    {
                        to: "flaky@todo.dev",
                        subject: "x",
                        body: "y",
                    })
                expect(first.retried).toEqual(["notif-1"])
                let attempt = await service.findById("notif-1")
                expect(attempt?.state).toBe("queued")
                expect(attempt?.failureClass).toBe("transient")

                // The host recovers; the next dispatch of the same attempt reaches delivered.
                smtp.clearFailuresFor("flaky@todo.dev")
                const second = await service.dispatchBatch(["notif-1"],
                    new Date("2026-09-18T06:20:00.000Z"),
                    {
                        to: "flaky@todo.dev",
                        subject: "x",
                        body: "y",
                    })
                expect(second.delivered).toEqual(["notif-1"])
                attempt = await service.findById("notif-1")
                expect(attempt?.state).toBe("delivered")
                expect(attempt?.attempt).toBe(2)
            })

        it("ac.notify.failure.classified.retries-transient: exhausting the retry budget lands on bounced with failureClass retries-exhausted, distinct from a real bounce",
            async () => {
                smtp.failTransientFor("always-flaky@todo.dev")
                await service.admit("notif-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    false)

                let now = new Date("2026-09-18T06:10:00.000Z")
                for (let i = 0; i < RETRY_BUDGET; i += 1) {
                    const result = await service.dispatchBatch(["notif-1"],
                        now,
                        {
                            to: "always-flaky@todo.dev", subject: "x", body: "y" 
                        })
                    if (i < RETRY_BUDGET - 1) {
                        expect(result.retried).toEqual(["notif-1"])
                    } else {
                        expect(result.bounced).toEqual(["notif-1"])
                    }
                    now = new Date(now.getTime() + 60_000)
                }

                const attempt = await service.findById("notif-1")
                expect(attempt?.state).toBe("bounced")
                expect(attempt?.failureClass).toBe("retries-exhausted")
                expect(attempt?.attempt).toBe(RETRY_BUDGET)
            })

        it("dispatching a batch renders one message covering every member (br.notify.digest.window)",
            async () => {
                await service.admit("notif-1",
                    new Date("2026-09-18T06:00:00.000Z"),
                    false)
                await service.admit("notif-2",
                    new Date("2026-09-18T06:01:00.000Z"),
                    false)

                const result = await service.dispatchBatch(["notif-1",
                    "notif-2"],
                new Date("2026-09-18T06:10:00.000Z"),
                {
                    to: "owner@todo.dev",
                    subject: "Two things happened",
                    body: "one, two",
                })

                expect(result.delivered.sort()).toEqual(["notif-1",
                    "notif-2"])
                expect(smtp.sent).toHaveLength(1)
            })
    })
