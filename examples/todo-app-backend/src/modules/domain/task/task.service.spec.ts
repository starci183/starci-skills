import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { TaskErrorCode } from "./errors/task.error"
import { TaskEntity } from "./persistence/entities/task.entity"
import type { TaskView } from "./task.contracts"
import { TaskService } from "./task.service"

const AT = new Date("2026-09-30T10:00:00.000Z")

const open: TaskView = { id: "t1", owner: "o1", title: "Write", complete: false, completedAt: null }
const done: TaskView = { ...open, complete: true, completedAt: AT }

const echoSave = jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

describe("TaskService", () => {
    it("creates a task owned by the caller with a trimmed title, through the manager it was given", async () => {
        const own = mockEntityManager()
        const inTransaction = mockEntityManager({ save: echoSave })
        const outcome = await new TaskService(own).create({ manager: inTransaction, ownerId: "o1", title: "  Write  " })
        expect(outcome).toMatchObject({ kind: "ok", value: { owner: "o1", title: "Write", complete: false, completedAt: null } })
        expect(inTransaction.save).toHaveBeenCalledWith(TaskEntity, expect.objectContaining({ owner: "o1", title: "Write" }))
        expect(own.save).not.toHaveBeenCalled()
    })

    it("refuses a blank title and writes nothing", async () => {
        const inTransaction = mockEntityManager({ save: echoSave })
        echoSave.mockClear()
        const outcome = await new TaskService(mockEntityManager()).create({ manager: inTransaction, ownerId: "o1", title: "   " })
        expect(outcome).toEqual({ kind: "refused", code: TaskErrorCode.TitleRequired, params: undefined })
        expect(inTransaction.save).not.toHaveBeenCalled()
    })

    it("finds a task by id and answers null for an unknown one", async () => {
        const found = mockEntityManager({ findOneBy: jest.fn().mockResolvedValueOnce({ ...open }).mockResolvedValueOnce(null) })
        const service = new TaskService(found)
        await expect(service.find({ id: "t1" })).resolves.toEqual(open)
        await expect(service.find({ id: "nope" })).resolves.toBeNull()
        expect(found.findOneBy).toHaveBeenCalledWith(TaskEntity, { id: "t1" })
    })

    it("lists only the tasks of one owner, bounded", async () => {
        const manager = mockEntityManager({ find: jest.fn().mockResolvedValue([{ ...open }]) })
        await expect(new TaskService(manager).listOwnedBy({ ownerId: "o1" })).resolves.toEqual([open])
        expect(manager.find).toHaveBeenCalledWith(TaskEntity, { where: { owner: "o1" }, take: LIST_ROWS_MAX })
    })

    it("completes an open task at the given instant", async () => {
        const inTransaction = mockEntityManager({ save: echoSave })
        const result = await new TaskService(mockEntityManager()).complete({ manager: inTransaction, task: open, at: AT })
        expect(result).toEqual(done)
    })

    it("leaves a complete task untouched when it is completed again", async () => {
        const inTransaction = mockEntityManager({ save: jest.fn() })
        const result = await new TaskService(mockEntityManager()).complete({ manager: inTransaction, task: done, at: AT })
        expect(result).toBe(done)
        expect(inTransaction.save).not.toHaveBeenCalled()
    })

    it("reopens a task and clears the completion instant", async () => {
        const inTransaction = mockEntityManager({ save: echoSave })
        const result = await new TaskService(mockEntityManager()).reopen({ manager: inTransaction, task: done, at: AT })
        expect(result).toEqual(open)
    })

    it("deletes the row by id", async () => {
        const inTransaction = mockEntityManager({ delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }) })
        await new TaskService(mockEntityManager()).remove({ manager: inTransaction, id: "t1" })
        expect(inTransaction.delete).toHaveBeenCalledWith(TaskEntity, "t1")
    })
})
