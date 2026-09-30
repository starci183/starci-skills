import { mock } from "@starci/jest-preset/mock"
import type { PlanDefinition, SubscriptionService } from "@modules/domain/plan"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { PlanUsageHandler } from "./plan-usage.handler"
import { PlanUsageQuery } from "./plan-usage.query"

const principal: Principal = { id: "p1", roles: ["member"] }
const AT = new Date("2026-09-30T10:00:00.000Z")
const task = (id: string, complete: boolean): TaskView => ({
    id,
    owner: "p1",
    title: id,
    complete,
    completedAt: complete ? AT : null,
})

const handlerFor = (plan: PlanDefinition, owned: ReadonlyArray<TaskView>): { handler: PlanUsageHandler; subscriptions: SubscriptionService; tasks: TaskService } => {
    const subscriptions = mock<SubscriptionService>({ readEffectivePlan: jest.fn().mockResolvedValue(plan) })
    const tasks = mock<TaskService>({ listOwnedBy: jest.fn().mockResolvedValue(owned) })
    return { handler: new PlanUsageHandler(mock<Logger>(), subscriptions, tasks), subscriptions, tasks }
}

describe("PlanUsageHandler", () => {
    it("shows a free caller the active count against the cap of 20, excluding completed tasks", async () => {
        const { handler, subscriptions, tasks } = handlerFor({ id: "free", taskCap: 20 }, [task("a", false), task("b", true), task("c", false)])
        await expect(handler.execute(new PlanUsageQuery({ request: {}, principal }))).resolves.toEqual({
            plan: "free",
            cap: 20,
            activeCount: 2,
        })
        expect(subscriptions.readEffectivePlan).toHaveBeenCalledWith({ personId: "p1" })
        expect(tasks.listOwnedBy).toHaveBeenCalledWith({ ownerId: "p1" })
    })

    it("shows a paid caller no cap", async () => {
        const { handler } = handlerFor({ id: "paid", taskCap: null }, [task("a", false)])
        await expect(handler.execute(new PlanUsageQuery({ request: {}, principal }))).resolves.toEqual({
            plan: "paid",
            cap: null,
            activeCount: 1,
        })
    })
})
