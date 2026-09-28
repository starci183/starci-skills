import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "./graphql"
import { listTasks, createTask, setTaskComplete, deleteTask } from "./tasks"

vi.mock("./graphql", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("./graphql")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("listTasks", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("projects the tasks query result into the Task shape (br.task.list.owned)", async () => {
        mockedGraphql().mockResolvedValueOnce({
            ok: true,
            data: [{ taskId: "t-1", title: "Ship it", complete: false }],
        })

        await expect(listTasks("tok-1")).resolves.toEqual([{ id: "t-1", title: "Ship it", complete: false }])
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("tasks"), undefined, "tok-1")
    })

    it("throws when the transport refuses (an expired or missing session)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "The session is not active.", code: "SESSION_NOT_FOUND" })

        await expect(listTasks("tok-1")).rejects.toThrow("The session is not active.")
    })
})

describe("createTask", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("creates an incomplete task from its trimmed title", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { taskId: "t-2", title: "Prove the boot path" } })

        await expect(createTask("tok-1", "Prove the boot path")).resolves.toEqual({ id: "t-2", title: "Prove the boot path", complete: false })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("createTask"), { input: { title: "Prove the boot path" } }, "tok-1")
    })
})

describe("setTaskComplete", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("dispatches completeTask when setting complete to true", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { taskId: "t-1", complete: true } })

        await expect(setTaskComplete("tok-1", "t-1", true)).resolves.toEqual({ id: "t-1", title: "", complete: true })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("completeTask"), { id: "t-1" }, "tok-1")
    })

    it("dispatches reopenTask when setting complete to false (br.task.complete.once reopen half)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { taskId: "t-1", complete: false } })

        await expect(setTaskComplete("tok-1", "t-1", false)).resolves.toEqual({ id: "t-1", title: "", complete: false })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("reopenTask"), { id: "t-1" }, "tok-1")
    })
})

describe("deleteTask", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("resolves with nothing once the backend confirms the delete (br.task.delete.final)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { deleted: true } })

        await expect(deleteTask("tok-1", "t-1")).resolves.toBeUndefined()
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("deleteTask"), { id: "t-1" }, "tok-1")
    })

    it("throws when the caller does not own the task", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "This task belongs to somebody else.", code: "TASK_FORBIDDEN" })

        await expect(deleteTask("tok-1", "t-1")).rejects.toThrow("This task belongs to somebody else.")
    })
})
