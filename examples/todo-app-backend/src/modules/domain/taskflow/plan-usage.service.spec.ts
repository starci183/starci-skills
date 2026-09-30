import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SubscriptionService } from "@modules/domain/plan"
import { TaskService } from "@modules/domain/task"
import { completedTaskRow, taskRow } from "@tests/fixtures/builders/task.builder"
import { PlanUsageService } from "./plan-usage.service"

const build = async () => {
    const subscriptions = mock<SubscriptionService>()
    const tasks = mock<TaskService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlanUsageService,
            { provide: SubscriptionService, useValue: subscriptions },
            { provide: TaskService, useValue: tasks },
        ],
    }).compile()
    return { service: moduleRef.get(PlanUsageService), subscriptions, tasks }
}

describe("PlanUsageService", () => {
    describe("read", () => {
        it("reports the free plan with its cap and counts only the active tasks", async () => {
            const { service, subscriptions, tasks } = await build()
            subscriptions.readEffectivePlan.mockResolvedValue({ id: "free", taskCap: 3 })
            tasks.listOwnedBy.mockResolvedValue([taskRow({ id: "a" }), completedTaskRow({ id: "b" }), taskRow({ id: "c" })])

            await expect(service.read({ personId: "p-1" })).resolves.toEqual({ plan: "free", cap: 3, activeCount: 2 })

            expect(subscriptions.readEffectivePlan).toHaveBeenCalledWith({ personId: "p-1" })
            expect(tasks.listOwnedBy).toHaveBeenCalledWith({ ownerId: "p-1" })
        })

        it("reports the paid plan without a cap", async () => {
            const { service, subscriptions, tasks } = await build()
            subscriptions.readEffectivePlan.mockResolvedValue({ id: "paid", taskCap: null })
            tasks.listOwnedBy.mockResolvedValue([])

            await expect(service.read({ personId: "p-1" })).resolves.toEqual({ plan: "paid", cap: null, activeCount: 0 })
        })
    })
})
