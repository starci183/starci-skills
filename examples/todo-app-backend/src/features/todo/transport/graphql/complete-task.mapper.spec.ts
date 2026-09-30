import { toCompleteTaskRequest, toCompleteTaskType } from "./complete-task.mapper"

describe("complete-task mapper", () => {
    it("maps the input id to the task id and the transition to the type", () => {
        expect(toCompleteTaskRequest({ id: "t1" })).toEqual({ taskId: "t1" })
        expect(toCompleteTaskType({ taskId: "t1", complete: true })).toEqual({ taskId: "t1", complete: true })
    })
})
