import { toReopenTaskRequest, toReopenTaskType } from "./reopen-task.mapper"

describe("reopen-task mapper", () => {
    it("maps the input id to the task id and the transition to the type", () => {
        expect(toReopenTaskRequest({ id: "t1" })).toEqual({ taskId: "t1" })
        expect(toReopenTaskType({ taskId: "t1", complete: false })).toEqual({ taskId: "t1", complete: false })
    })
})
