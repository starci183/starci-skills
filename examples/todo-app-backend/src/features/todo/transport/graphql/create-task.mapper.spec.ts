import { toCreateTaskRequest, toCreateTaskType } from "./create-task.mapper"

describe("create-task mapper", () => {
    it("maps the input to the request and the created task to the type", () => {
        expect(toCreateTaskRequest({ title: "Write" })).toEqual({ title: "Write" })
        expect(toCreateTaskType({ taskId: "t1", title: "Write" })).toEqual({ taskId: "t1", title: "Write" })
    })
})
