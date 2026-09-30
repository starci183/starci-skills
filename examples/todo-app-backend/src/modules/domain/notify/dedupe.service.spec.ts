import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IsNull } from "typeorm"
import { NOTIFY_AT, dedupeAdmitInput, notificationRow } from "@tests/fixtures/builders/notify.builder"
import { DedupeService } from "./dedupe.service"
import { NotifyNotificationEntity } from "./persistence/entities/notification.entity"
import { INSERT_NOTIFICATION_IF_ABSENT } from "./persistence/notify.sql"

const AT = new Date(NOTIFY_AT)
const KEY = createHash("sha256").update("task-complete:evt-1:p1").digest("hex")

const build = async (stored = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DedupeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: stored }],
    }).compile()
    return { service: moduleRef.get(DedupeService), stored }
}

describe("DedupeService", () => {
    describe("admit", () => {
        it("inserts a new notification under the sha256 key of kind, event and recipient and reports it new", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ query: [INSERT_NOTIFICATION_IF_ABSENT, [{ id: KEY }]] })

            const result = await service.admit({ manager, ...dedupeAdmitInput() })

            expect(result).toEqual({
                isNew: true,
                notification: {
                    id: KEY,
                    kind: "task-complete",
                    recipientId: "p1",
                    payload: { taskId: "t1" },
                    digestGroupId: null,
                    createdAt: AT,
                },
            })
            expect(manager.query).toHaveBeenCalledTimes(1)
            expect(manager.query).toHaveBeenCalledWith(INSERT_NOTIFICATION_IF_ABSENT, [
                KEY,
                "task-complete",
                "p1",
                JSON.stringify({ taskId: "t1" }),
                AT,
            ])
        })

        it("reads back the stored row of an event that was admitted before and reports it not new", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                query: [INSERT_NOTIFICATION_IF_ABSENT, []],
                findOneBy: [NotifyNotificationEntity, notificationRow({ id: KEY })],
            })

            const result = await service.admit({ manager, ...dedupeAdmitInput() })

            expect(result.isNew).toBe(false)
            expect(result.notification).toEqual({
                id: KEY,
                kind: "task-complete",
                recipientId: "p1",
                payload: { taskId: "t1" },
                digestGroupId: "w1",
                createdAt: AT,
            })
            expect(manager.findOneBy).toHaveBeenCalledWith(NotifyNotificationEntity, { id: KEY })
        })

        it("answers the fresh view as not new when the conflicting row is gone by the time it is read", async () => {
            const { service } = await build()
            const manager = mockEntityManager({
                query: [INSERT_NOTIFICATION_IF_ABSENT, []],
                findOneBy: [NotifyNotificationEntity, null],
            })

            const result = await service.admit({ manager, ...dedupeAdmitInput() })

            expect(result.isNew).toBe(false)
            expect(result.notification.digestGroupId).toBeNull()
            expect(result.notification.id).toBe(KEY)
        })

        it("keeps two events with the same facts apart because the key ignores the payload", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ query: [INSERT_NOTIFICATION_IF_ABSENT, [{ id: "x" }]] })

            const first = await service.admit({ manager, ...dedupeAdmitInput() })
            const second = await service.admit({ manager, ...dedupeAdmitInput({ sourceEventId: "evt-2" }) })

            expect(first.notification.id).not.toBe(second.notification.id)
        })
    })

    describe("findByDigestGroup", () => {
        it("reads the group in admission order, at most the list maximum", async () => {
            const stored = mockEntityManager({
                find: [NotifyNotificationEntity, [notificationRow({ id: "n1" }), notificationRow({ id: "n2", payload: { taskId: "t2" } })]],
            })
            const { service } = await build(stored)

            const views = await service.findByDigestGroup({ groupId: "w1" })

            expect(views.map((view) => view.id)).toEqual(["n1", "n2"])
            expect(views[1]?.payload).toEqual({ taskId: "t2" })
            expect(stored.find).toHaveBeenCalledWith(NotifyNotificationEntity, {
                where: { digestGroupId: "w1" },
                order: { createdAt: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })

        it("answers an empty group as an empty list", async () => {
            const { service } = await build(mockEntityManager({ find: [NotifyNotificationEntity, []] }))

            await expect(service.findByDigestGroup({ groupId: "w9" })).resolves.toEqual([])
        })
    })

    describe("assignDigestGroup", () => {
        it("sets the group only on a notification that has none, inside the caller transaction", async () => {
            const { service, stored } = await build()
            const manager = mockEntityManager({ update: [NotifyNotificationEntity, { affected: 1 }] })

            await service.assignDigestGroup({ manager, id: KEY, digestGroupId: "w1" })

            expect(manager.update).toHaveBeenCalledWith(
                NotifyNotificationEntity,
                { id: KEY, digestGroupId: IsNull() },
                { digestGroupId: "w1" },
            )
            expect(stored.update).not.toHaveBeenCalled()
        })
    })
})
