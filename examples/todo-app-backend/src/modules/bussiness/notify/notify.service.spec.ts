import {
    Test 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    NotifyService 
} from "./notify.service"
import {
    DedupeService 
} from "./dedupe.service"
import {
    DigestService 
} from "./digest.service"
import {
    PreferencesService 
} from "./preferences.service"
import {
    DeliveryService 
} from "./delivery.service"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    NotifySmtpPort 
} from "@modules/integrations/notify-smtp/notify-smtp.contracts"
import {
    NotifyQueuePort 
} from "@modules/integrations/notify-queue/notify-queue.contracts"
import {
    createFakeNotifyEntityManager 
} from "./testing/fake-notify-entity-manager"
import {
    FakeNotifySmtpClient 
} from "@modules/integrations/notify-smtp/testing/fake-notify-smtp.client"
import {
    FakeNotifyQueueClient 
} from "@modules/integrations/notify-queue/testing/fake-notify-queue.client"
import {
    NotifyDeliveryAttemptEntity 
} from "@modules/platform/databases/postgresql/primary/entities/notify-delivery-attempt.entity"

async function buildNotify() {
    const smtp = new FakeNotifySmtpClient()
    const queue = new FakeNotifyQueueClient()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NotifyService,
            DedupeService,
            DigestService,
            PreferencesService,
            DeliveryService,
            {
                provide: NotifySmtpPort, useValue: smtp 
            },
            {
                provide: NotifyQueuePort, useValue: queue 
            },
            {
                provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
            },
        ],
    }).compile()
    return {
        moduleRef,
        notify: moduleRef.get(NotifyService),
        dedupe: moduleRef.get(DedupeService),
        digest: moduleRef.get(DigestService),
        preferences: moduleRef.get(PreferencesService),
        delivery: moduleRef.get(DeliveryService),
        smtp,
        queue,
    }
}

describe("NotifyService",
    () => {
        it("fr.notify.on-completion: admitting a task-complete event queues a delivery inside the digest window",
            async () => {
                const { moduleRef, notify, delivery } = await buildNotify()
                try {
                    const t0 = new Date("2026-09-18T06:00:00.000Z")

                    const result = await notify.admit(
                        {
                            kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                                taskId: "task-1" 
                            } 
                        },
                        t0,
                    )

                    expect(result.isNew).toBe(true)
                    expect(result.deliveryState).toBe("queued")
                    const attempt = await delivery.findById(result.notificationId)
                    expect(attempt?.state).toBe("queued")
                } finally {
                    await moduleRef.close()
                }
            })

        it("br.notify.delivery.once: admitting the same (kind, sourceEventId, recipientId) twice never creates a second delivery attempt",
            async () => {
                const { moduleRef, notify } = await buildNotify()
                try {
                    const t0 = new Date("2026-09-18T06:00:00.000Z")
                    const input = {
                        kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                        } 
                    }

                    const first = await notify.admit(input,
                        t0)
                    const second = await notify.admit(input,
                        new Date(t0.getTime() + 1_000))

                    expect(second.isNew).toBe(false)
                    expect(second.notificationId).toBe(first.notificationId)
                } finally {
                    await moduleRef.close()
                }
            })

        it("fr.notify.digest / ac.notify.digest.window.collapses-into-one-message: two events for the same person and channel become one message when the window closes",
            async () => {
                const { moduleRef, notify, smtp } = await buildNotify()
                try {
                    const t0 = new Date("2026-09-18T06:00:00.000Z")
                    const t1 = new Date("2026-09-18T06:05:00.000Z")

                    await notify.admit({
                        kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                            taskId: "task-1" 
                        } 
                    },
                    t0)
                    await notify.admit({
                        kind: "task-complete", sourceEventId: "evt-2", recipientId: "owner-1", channel: "email", payload: {
                            taskId: "task-2" 
                        } 
                    },
                    t1)

                    // Before the (default 10-minute) window closes, nothing goes out.
                    await notify.runDueJobs(new Date("2026-09-18T06:09:00.000Z"))
                    expect(smtp.sent).toHaveLength(0)

                    // At close, both events are read together as one message.
                    await notify.runDueJobs(new Date("2026-09-18T06:10:00.000Z"))
                    expect(smtp.sent).toHaveLength(1)
                    expect(smtp.sent[0].body).toContain("task-1")
                    expect(smtp.sent[0].body).toContain("task-2")
                } finally {
                    await moduleRef.close()
                }
            })

        it("fr.notify.unsubscribe / ac.notify.unsubscribe.honored.suppresses-future-sends: an unsubscribed recipient never joins a window and never receives a message",
            async () => {
                const { moduleRef, notify, preferences, smtp } = await buildNotify()
                try {
                    await preferences.setUnsubscribed("owner-1",
                        "email",
                        true)

                    const result = await notify.admit(
                        {
                            kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                                taskId: "task-1" 
                            } 
                        },
                        new Date("2026-09-18T06:00:00.000Z"),
                    )

                    expect(result.deliveryState).toBe("suppressed")
                    await notify.runDueJobs(new Date("2026-09-18T06:20:00.000Z"))
                    expect(smtp.sent).toHaveLength(0)
                } finally {
                    await moduleRef.close()
                }
            })

        it("re-subscribing lets a later event reach the digest window again",
            async () => {
                const { moduleRef, notify, preferences, smtp } = await buildNotify()
                try {
                    await preferences.setUnsubscribed("owner-1",
                        "email",
                        true)
                    await notify.admit(
                        {
                            kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                            } 
                        },
                        new Date("2026-09-18T06:00:00.000Z"),
                    )
                    await preferences.setUnsubscribed("owner-1",
                        "email",
                        false)

                    const second = await notify.admit(
                        {
                            kind: "task-complete", sourceEventId: "evt-2", recipientId: "owner-1", channel: "email", payload: {
                                taskId: "task-2" 
                            } 
                        },
                        new Date("2026-09-18T06:01:00.000Z"),
                    )
                    expect(second.deliveryState).toBe("queued")

                    await notify.runDueJobs(new Date("2026-09-18T06:20:00.000Z"))
                    expect(smtp.sent).toHaveLength(1)
                    expect(smtp.sent[0].body).toContain("task-2")
                } finally {
                    await moduleRef.close()
                }
            })

        it("nfr.notify.delivery.guarantee: a transient failure retries and eventually delivers exactly once",
            async () => {
                const { moduleRef, notify, smtp, delivery } = await buildNotify()
                try {
                    smtp.failTransientFor("owner-1")
                    const t0 = new Date("2026-09-18T06:00:00.000Z")

                    const admitted = await notify.admit(
                        {
                            kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", channel: "email", payload: {
                                taskId: "task-1" 
                            } 
                        },
                        t0,
                    )

                    await notify.runDueJobs(new Date("2026-09-18T06:10:00.000Z")) // window closes: first dispatch, fails transiently
                    let attempt = await delivery.findById(admitted.notificationId)
                    expect(attempt?.state).toBe("queued")
                    expect(attempt?.failureClass).toBe("transient")
                    expect(smtp.sent).toHaveLength(0)

                    // Before the retry backoff elapses, nothing new is due.
                    await notify.runDueJobs(new Date("2026-09-18T06:10:15.000Z"))
                    expect(smtp.sent).toHaveLength(0)

                    smtp.clearFailuresFor("owner-1")
                    await notify.runDueJobs(new Date("2026-09-18T06:10:31.000Z")) // 30s backoff elapsed: retry succeeds
                    attempt = await delivery.findById(admitted.notificationId)
                    expect(attempt?.state).toBe("delivered")
                    expect(smtp.sent).toHaveLength(1)
                } finally {
                    await moduleRef.close()
                }
            })

        describe("job and rendering arms (w8 branch depth)",
            () => {
                it("a queue job with neither known prefix is skipped without failing the tick",
                    async () => {
                        const { moduleRef, notify, queue, smtp } = await buildNotify()
                        try {
                            await queue.enqueue("bogus:whatever",
                                Date.now() - 1)
                            await notify.runDueJobs(new Date())
                            expect(smtp.sent).toHaveLength(0)
                            expect(queue.has("bogus:whatever")).toBe(false)
                        } finally {
                            await moduleRef.close()
                        }
                    })

                it("a flush job for an unknown or already-flushed window is a no-op",
                    async () => {
                        const { moduleRef, notify, queue, smtp } = await buildNotify()
                        try {
                            await queue.enqueue("flush:window-that-never-existed",
                                Date.now() - 1)
                            await notify.runDueJobs(new Date())
                            expect(smtp.sent).toHaveLength(0)
                        } finally {
                            await moduleRef.close()
                        }
                    })

                it("a non-task-complete kind renders the generic subject, and a missing taskId renders empty",
                    async () => {
                        const { moduleRef, notify, smtp } = await buildNotify()
                        try {
                            const t0 = new Date("2026-09-18T06:00:00.000Z")
                            await notify.admit({
                                kind: "share-invite", sourceEventId: "evt-s1", recipientId: "owner-1", channel: "email", payload: {
                                    invitationId: "inv-1" 
                                } 
                            },
                            t0)
                            await notify.runDueJobs(new Date("2026-09-18T06:20:00.000Z"))
                            expect(smtp.sent).toHaveLength(1)
                            expect(smtp.sent[0].subject).toContain("Notification")
                            expect(smtp.sent[0].body).toContain("share-invite")
                            expect(smtp.sent[0].body).toContain("inv-1")
                        } finally {
                            await moduleRef.close()
                        }
                    })

                it("a dedupe hit whose delivery attempt row is gone reports the queued fallback, not a crash",
                    async () => {
                        const {
                            moduleRef, notify, delivery 
                        } = await buildNotify()
                        try {
                            const input = {
                                kind: "task-complete", sourceEventId: "evt-9", recipientId: "owner-1", channel: "email", payload: {
                                    taskId: "task-9" 
                                } 
                            }
                            const first = await notify.admit(input,
                                new Date("2026-09-18T06:00:00.000Z"))
                            expect(first.isNew).toBe(true)

                            // Simulate a lost attempt row: the second admission must still answer
                            // coherently (queued) rather than reading undefined state.
                            const entityManager = moduleRef.get<{
                                delete(target: unknown, criteria: string): Promise<void>;
                            }>(getEntityManagerToken(POSTGRESQL_PRIMARY))
                            await entityManager.delete(NotifyDeliveryAttemptEntity,
                                first.notificationId)
                            expect(await delivery.findById(first.notificationId)).toBeNull()

                            const second = await notify.admit(input,
                                new Date("2026-09-18T06:00:01.000Z"))
                            expect(second.isNew).toBe(false)
                            expect(second.deliveryState).toBe("queued")
                        } finally {
                            await moduleRef.close()
                        }
                    })
            })
    })
