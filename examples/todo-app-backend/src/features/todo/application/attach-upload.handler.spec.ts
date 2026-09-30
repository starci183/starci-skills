import { mock } from "@starci/jest-preset/mock"
import type { TaskService, TaskView } from "@modules/domain/task"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { AttachUploadCommand } from "./attach-upload.command"
import { AttachUploadHandler } from "./attach-upload.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const upload: UploadView = {
    id: "u1",
    owner: "owner-1",
    taskId: null,
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status: "ready",
    createdAt: AT,
}
const task: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }
const command = new AttachUploadCommand({ request: { uploadId: "u1", taskId: "t1" }, principal })

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: AttachUploadHandler
    uploads: UploadService
    tasks: TaskService
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    parts: { authorized?: unknown; ready?: unknown; task?: TaskView | null } = {},
): Built => {
    const inner = mockEntityManager()
    const uploads = mock<UploadService>({
        authorize: jest.fn().mockResolvedValue(parts.authorized ?? { kind: "ok", value: upload }),
        requireReady: jest.fn().mockReturnValue(parts.ready ?? { kind: "ok", value: upload }),
        attach: jest.fn().mockResolvedValue({ ...upload, taskId: "t1" }),
    })
    const tasks = mock<TaskService>({ find: jest.fn().mockResolvedValue(parts.task === undefined ? task : parts.task) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new AttachUploadHandler(mock<Logger>(), entityManager, uploads, tasks), uploads, tasks, inner }
}

describe("AttachUploadHandler", () => {
    it("attaches the ready upload of the caller to a task of the caller in a transaction", async () => {
        const { handler, uploads, inner } = build()
        const result = await handler.execute(command)
        expect(result).toMatchObject({ kind: "ok", value: { uploadId: "u1", taskId: "t1", status: "ready" } })
        expect(uploads.authorize).toHaveBeenCalledWith({ uploadId: "u1", actorId: "owner-1" })
        expect(uploads.attach).toHaveBeenCalledWith({ manager: inner, upload, taskId: "t1" })
    })

    it("refuses a stranger upload, or a missing one, before it looks at the task", async () => {
        for (const code of [UploadErrorCode.Forbidden, UploadErrorCode.NotFound]) {
            const authorized = { kind: "refused", code, params: { uploadId: "u1" } }
            const { handler, tasks, uploads } = build({ authorized })
            await expect(handler.execute(command)).resolves.toEqual(authorized)
            expect(tasks.find).not.toHaveBeenCalled()
            expect(uploads.attach).not.toHaveBeenCalled()
        }
    })

    it("refuses a pending upload and attaches nothing", async () => {
        const ready = { kind: "refused", code: UploadErrorCode.NotReady, params: { uploadId: "u1" } }
        const { handler, uploads } = build({ ready })
        await expect(handler.execute(command)).resolves.toEqual(ready)
        expect(uploads.attach).not.toHaveBeenCalled()
    })

    it("refuses a task that is not there, carrying the task id, and attaches nothing", async () => {
        const { handler, uploads } = build({ task: null })
        await expect(handler.execute(command)).resolves.toEqual({
            kind: "refused",
            code: UploadErrorCode.NotFound,
            params: { taskId: "t1" },
        })
        expect(uploads.attach).not.toHaveBeenCalled()
    })

    it("refuses a task owned by somebody else, carrying the task id, and attaches nothing", async () => {
        const { handler, uploads } = build({ task: { ...task, owner: "someone-else" } })
        await expect(handler.execute(command)).resolves.toEqual({
            kind: "refused",
            code: UploadErrorCode.Forbidden,
            params: { taskId: "t1" },
        })
        expect(uploads.attach).not.toHaveBeenCalled()
    })
})
