import { mock } from "@starci/jest-preset/mock"
import type { TaskService, TaskView } from "@modules/domain/task"
import { UploadErrorCode } from "@modules/domain/upload"
import type { UploadService, UploadView } from "@modules/domain/upload"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ListTaskUploadsHandler } from "./list-task-uploads.handler"
import { ListTaskUploadsQuery } from "./list-task-uploads.query"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const task: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }
const upload: UploadView = {
    id: "u1",
    owner: "owner-1",
    taskId: "t1",
    filename: "note.txt",
    mime: "text/plain",
    sizeBytes: 3,
    storageKey: "uploads/u1",
    status: "ready",
    createdAt: AT,
}
const query = new ListTaskUploadsQuery({ request: { taskId: "t1" }, principal })

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: ListTaskUploadsHandler
    uploads: UploadService
}

const build = (found: TaskView | null = task): Built => {
    const uploads = mock<UploadService>({ listForTask: jest.fn().mockResolvedValue([upload]) })
    const tasks = mock<TaskService>({ find: jest.fn().mockResolvedValue(found) })
    return { handler: new ListTaskUploadsHandler(mock<Logger>(), uploads, tasks), uploads }
}

describe("ListTaskUploadsHandler", () => {
    it("lists the uploads of the caller on a task the caller owns, as summaries", async () => {
        const { handler, uploads } = build()
        const result = await handler.execute(query)
        expect(result).toEqual({
            kind: "ok",
            value: {
                uploads: [
                    {
                        uploadId: "u1",
                        taskId: "t1",
                        filename: "note.txt",
                        mime: "text/plain",
                        sizeBytes: 3,
                        status: "ready",
                        createdAt: AT,
                    },
                ],
            },
        })
        expect(uploads.listForTask).toHaveBeenCalledWith({ taskId: "t1", ownerId: "owner-1" })
    })

    it("refuses a stranger before reading any upload, not even revealing that the task exists as theirs", async () => {
        const { handler, uploads } = build({ ...task, owner: "someone-else" })
        await expect(handler.execute(query)).resolves.toEqual({
            kind: "refused",
            code: UploadErrorCode.Forbidden,
            params: { taskId: "t1" },
        })
        expect(uploads.listForTask).not.toHaveBeenCalled()
    })

    it("refuses a task that is not there and reads no upload", async () => {
        const { handler, uploads } = build(null)
        await expect(handler.execute(query)).resolves.toEqual({
            kind: "refused",
            code: UploadErrorCode.NotFound,
            params: { taskId: "t1" },
        })
        expect(uploads.listForTask).not.toHaveBeenCalled()
    })
})
