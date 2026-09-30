import { toListTasksType } from "./list-tasks.mapper"

describe("list-tasks mapper", () => {
    it("maps every listed task and keeps the order", () => {
        const tasks = [
            { taskId: "t1", title: "A", complete: false },
            { taskId: "t2", title: "B", complete: true },
        ]
        expect(toListTasksType({ tasks })).toEqual(tasks)
    })

    it("maps no tasks to an empty list", () => {
        expect(toListTasksType({ tasks: [] })).toEqual([])
    })
})
