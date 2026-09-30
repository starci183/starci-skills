import { toDeleteTaskRequest, toDeleteTaskType } from "./delete-task.mapper"

describe("delete-task mapper", () => {
    it("maps the input id to the task id and the confirmation to the type", () => {
        expect(toDeleteTaskRequest({ id: "t1" })).toEqual({ taskId: "t1" })
        expect(toDeleteTaskType({ deleted: true })).toEqual({ deleted: true })
    })
})
