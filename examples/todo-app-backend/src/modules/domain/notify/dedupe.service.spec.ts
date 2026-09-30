import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { IsNull } from "typeorm"
import { DedupeService } from "./dedupe.service"
import { computeDedupeKey } from "./notify.policy"
import { NotifyNotificationEntity } from "./persistence/entities/notification.entity"
import { INSERT_NOTIFICATION_IF_ABSENT } from "./persistence/notify.sql"

const AT = new Date("2026-09-30T10:00:00.000Z")
const KEY = computeDedupeKey("task-complete", "evt-1", "p1")
const params = { kind: "task-complete", sourceEventId: "evt-1", recipientId: "p1", payload: { taskId: "t1" }, at: AT }

const stored = Object.assign(new NotifyNotificationEntity(), {
    id: KEY,
    kind: "task-complete",
    recipientId: "p1",
    payload: { taskId: "t1" },
    digestGroupId: "w1",
    createdAt: new Date("2026-09-30T09:00:00.000Z"),
})

describe("DedupeService", () => {
    it("inserts a first admission under its dedupe key through the manager it was given", async () => {
        const inTransaction = mockEntityManager({ query: jest.fn().mockResolvedValue([{ id: KEY }]) })
        const own = mockEntityManager()
        const result = await new DedupeService(own).admit({ manager: inTransaction, ...params })
        expect(result.isNew).toBe(true)
        expect(result.notification).toEqual({
            id: KEY,
            kind: "task-complete",
            recipientId: "p1",
            payload: { taskId: "t1" },
            digestGroupId: null,
            createdAt: AT,
        })
        expect(inTransaction.query).toHaveBeenCalledWith(INSERT_NOTIFICATION_IF_ABSENT, [
            KEY,
            "task-complete",
            "p1",
            JSON.stringify({ taskId: "t1" }),
            AT,
        ])
        expect(own.query).not.toHaveBeenCalled()
    })

    it("answers the stored row and isNew false when the same event was admitted before", async () => {
        const inTransaction = mockEntityManager({
            query: jest.fn().mockResolvedValue([]),
            findOneBy: jest.fn().mockResolvedValue(stored),
        })
        const result = await new DedupeService(mockEntityManager()).admit({ manager: inTransaction, ...params })
        expect(result.isNew).toBe(false)
        expect(result.notification).toMatchObject({ id: KEY, digestGroupId: "w1" })
        expect(inTransaction.findOneBy).toHaveBeenCalledWith(NotifyNotificationEntity, { id: KEY })
    })

    it("lists one digest group in admission order, bounded", async () => {
        const own = mockEntityManager({ find: jest.fn().mockResolvedValue([stored]) })
        const group = await new DedupeService(own).findByDigestGroup({ groupId: "w1" })
        expect(group).toHaveLength(1)
        expect(own.find).toHaveBeenCalledWith(NotifyNotificationEntity, {
            where: { digestGroupId: "w1" },
            order: { createdAt: "ASC" },
            take: LIST_ROWS_MAX,
        })
    })

    it("assigns the group only to a notification that has none yet", async () => {
        const inTransaction = mockEntityManager({ update: jest.fn().mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }) })
        await new DedupeService(mockEntityManager()).assignDigestGroup({ manager: inTransaction, id: KEY, digestGroupId: "w1" })
        expect(inTransaction.update).toHaveBeenCalledWith(
            NotifyNotificationEntity,
            { id: KEY, digestGroupId: IsNull() },
            { digestGroupId: "w1" },
        )
    })
})
