import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    CompletionAuthorityRegistry 
} from "../task/completion-authority.providers"
import {
    TaskCreationPolicyRegistry 
} from "../task/creation-policy.providers"
import {
    TaskService 
} from "../task/task.service"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakePlanEntityManager 
} from "./testing/fake-plan-entity-manager"
import {
    SubscriptionService 
} from "./subscription.service"
import {
    PlanCapGuardPolicy 
} from "./cap-guard.policy"

describe("PlanCapGuardPolicy (sds.plan.cap-guard)",
    () => {
        let moduleRef: TestingModule
        let taskService: TaskService
        let subscriptionService: SubscriptionService
        let policy: PlanCapGuardPolicy

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    PlanCapGuardPolicy,
                    TaskService,
                    CompletionAuthorityRegistry,
                    TaskCreationPolicyRegistry,
                    SubscriptionService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakePlanEntityManager() 
                    },
                ],
            }).compile()
            taskService = moduleRef.get(TaskService)
            subscriptionService = moduleRef.get(SubscriptionService)
            policy = moduleRef.get(PlanCapGuardPolicy)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("t-under-cap: a free person under 20 active tasks may create",
            async () => {
                for (let i = 0; i < 19; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                await expect(policy.assertMayCreate({
                    actorId: "owner-1" 
                })).resolves.toBeUndefined()
            })

        it("ac.plan.caps.limit.refuses-over-cap / t-at-cap: a free person at 20 active tasks is refused, naming the cap and the upgrade path",
            async () => {
                for (let i = 0; i < 20; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                await expect(policy.assertMayCreate({
                    actorId: "owner-1" 
                })).rejects.toMatchObject({
                    code: "PLAN_CAP_EXCEEDED_EXCEPTION",
                    metadata: expect.objectContaining({
                        cap: 20 
                    }),
                })
            })

        it("ac.plan.active-scope.excludes-complete: a completed task does not count toward the cap",
            async () => {
                for (let i = 0; i < 19; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                const completedOne = await taskService.create("owner-1",
                    "the 20th, soon completed")
                await taskService.complete(completedOne.id,
                    "owner-1")

                await expect(policy.assertMayCreate({
                    actorId: "owner-1" 
                })).resolves.toBeUndefined()
            })

        it("a paid person is never refused, however many active tasks they hold",
            async () => {
                for (let i = 0; i < 40; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                await subscriptionService.tCheckoutStarted("owner-1")
                const subscription = await subscriptionService.getOrCreate("owner-1")
                await subscriptionService.tGatewayConfirmed(subscription.id,
                    new Date("2027-01-01T00:00:00.000Z"))

                await expect(policy.assertMayCreate({
                    actorId: "owner-1" 
                })).resolves.toBeUndefined()
            })

        it("br.plan.downgrade.freeze / ac.plan.downgrade.freeze.over-cap-blocks-create: a downgraded-to-free person over the cap is refused the same way an at-cap create is",
            async () => {
                for (let i = 0; i < 40; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                await subscriptionService.tCheckoutStarted("owner-1")
                const subscription = await subscriptionService.getOrCreate("owner-1")
                await subscriptionService.tGatewayConfirmed(subscription.id,
                    new Date())
                await subscriptionService.tDowngrade("owner-1")

                await expect(policy.assertMayCreate({
                    actorId: "owner-1" 
                })).rejects.toMatchObject({
                    code: "PLAN_CAP_EXCEEDED_EXCEPTION" 
                })
            })

        it("contract.plan.create-precondition / gap.plan.cap-guard-not-wired: registered into TaskCreationPolicyRegistry, the registry itself refuses the over-cap create",
            async () => {
                const registry = moduleRef.get(TaskCreationPolicyRegistry)
                registry.register(policy)
                for (let i = 0; i < 20; i += 1) {
                    await taskService.create("owner-1",
                        `task-${i}`)
                }
                await expect(registry.assertMayCreate({
                    actorId: "owner-1" 
                },
                {
                    title: "one too many" 
                })).rejects.toMatchObject({
                    code: "PLAN_CAP_EXCEEDED_EXCEPTION",
                })
            })
    })
