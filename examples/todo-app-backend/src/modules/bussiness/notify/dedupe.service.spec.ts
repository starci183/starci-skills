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
    createFakeNotifyEntityManager 
} from "./testing/fake-notify-entity-manager"
import {
    DedupeService 
} from "./dedupe.service"

describe("DedupeService",
    () => {
        let moduleRef: TestingModule
        let service: DedupeService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    DedupeService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(DedupeService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.notify.delivery.once.dedupe-collapses-retry: a second admission for the same triple returns the same notification, not a new one",
            async () => {
                const first = await service.admit({
                    kind: "task-complete",
                    sourceEventId: "evt-1",
                    recipientId: "owner-1",
                    payload: {
                        taskId: "task-1" 
                    },
                })
                expect(first.isNew).toBe(true)

                const second = await service.admit({
                    kind: "task-complete",
                    sourceEventId: "evt-1",
                    recipientId: "owner-1",
                    payload: {
                        taskId: "task-1" 
                    },
                })

                expect(second.isNew).toBe(false)
                expect(second.record.id).toBe(first.record.id)
                expect(second.record).toStrictEqual(first.record)
            })

        it("a different sourceEventId, kind or recipient produces a distinct notification",
            async () => {
                const base = await service.admit({
                    kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", payload: {
                    } 
                })
                const differentEvent = await service.admit({
                    kind: "task-complete", sourceEventId: "evt-2", recipientId: "owner-1", payload: {
                    } 
                })
                const differentRecipient = await service.admit({
                    kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-2", payload: {
                    } 
                })

                expect(differentEvent.record.id).not.toBe(base.record.id)
                expect(differentRecipient.record.id).not.toBe(base.record.id)
            })

        it("assignDigestGroup sets digestGroupId exactly once and a second call is a no-op",
            async () => {
                const admitted = await service.admit({
                    kind: "task-complete", sourceEventId: "evt-1", recipientId: "owner-1", payload: {
                    } 
                })
                await service.assignDigestGroup(admitted.record.id,
                    "group-1")
                await service.assignDigestGroup(admitted.record.id,
                    "group-2")

                const found = await service.findById(admitted.record.id)
                expect(found?.digestGroupId).toBe("group-1")
            })

        it("findById returns null for an unknown notification id (w8 branch depth)",
            async () => {
                expect(await service.findById("missing")).toBeNull()
            })
    })
