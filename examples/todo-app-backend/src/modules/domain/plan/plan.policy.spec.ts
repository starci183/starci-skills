import { FREE_PLAN, FREE_PLAN_TASK_CAP, PAID_PLAN, planOfStatus } from "./plan.policy"

describe("plan policy", () => {
    it("caps the free plan at 20 active tasks and leaves the paid plan uncapped", () => {
        expect(FREE_PLAN).toEqual({ id: "free", taskCap: 20 })
        expect(FREE_PLAN_TASK_CAP).toBe(20)
        expect(PAID_PLAN).toEqual({ id: "paid", taskCap: null })
    })

    it("reads active and past-due as paid and every other status as free", () => {
        expect(planOfStatus("active")).toBe(PAID_PLAN)
        expect(planOfStatus("past-due")).toBe(PAID_PLAN)
        expect(planOfStatus("free")).toBe(FREE_PLAN)
        expect(planOfStatus("pending")).toBe(FREE_PLAN)
        expect(planOfStatus("lapsed")).toBe(FREE_PLAN)
    })
})
