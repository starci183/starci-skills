import type { TaskEntity } from "./entities/task.entity"
import { toTaskView } from "./task.rows"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("task rows mapper", () => {
    it("copies a completed task row into the view", () => {
        const row: TaskEntity = { id: "t1", owner: "p1", title: "Write", complete: true, completedAt: AT }
        expect(toTaskView(row)).toEqual(row)
    })

    it("keeps the completion instant of an open task null", () => {
        const row: TaskEntity = { id: "t2", owner: "p1", title: "Read", complete: false, completedAt: null }
        expect(toTaskView(row).completedAt).toBeNull()
    })
})
