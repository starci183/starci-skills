import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    CompleteTaskData,
    CreateTaskData,
    DowngradePlanData,
    PlanUsageData,
    SepayWebhookBody,
    UpgradePlanData,
} from "../setup/e2e-views.contracts"

const FREE_CAP = 20
const DAY_MS = 86_400_000

/**
 * fr.plan.* as one A->Z journey over the run-owned stack: the free cap bites at 20 active tasks, checkout starts through the
 * payment gateway stand-in the run owns (create-intent travels api -> gateway for real), the gateway confirmation arrives
 * through the signed webhook door, the cap lifts under the paid plan, and downgrade restores the cap (accept-and-freeze: no
 * task row is touched, the cap guard simply starts refusing creates again from the real count).
 *
 * The webhook door is exercised for real: an unsigned delivery is ignored and leaves the pending row untouched, the delivery
 * signed with the shared secret activates the subscription, and a replay of the same delivery is ignored again (the inbox
 * claim). Nothing is seeded out-of-band: every row is written by the api.
 */
describe("plan journey (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("plan/plan-journey")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("free cap refuses -> upgrade checkout -> gateway confirm -> cap lifts -> downgrade freezes -> completing below the cap reopens creation", async () => {
        const { graphql, auth, stack, database } = world
        const run = `e2e-plan-${randomUUID()}`
        const owner = await auth.persona("owner")
        const caller = graphql.client(owner.sessionToken)

        const usageNow = async (): Promise<PlanUsageData["planUsage"]> => {
            const observed = await caller.read<PlanUsageData>("planUsage")
            return present(observed.data, "planUsage data").planUsage
        }
        const createTask = (title: string) => caller.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        const webhook = (authorization: string, gatewayIntentId: string, periodEnd: string) =>
            world.http().post<SepayWebhookBody>("/webhooks/sepay", { id: gatewayIntentId, status: "paid", periodEnd }, { headers: { authorization } })

        // Baseline: the demo identity starts on the free plan, cap 20, nothing active.
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: 0 })

        // Fill the cap; the (cap+1)-th create is refused before anything is written, with the cap and the upgrade path as params.
        const taskIds: Array<string> = []
        for (let index = 1; index <= FREE_CAP; index += 1) {
            const created = await createTask(`${run}-cap-${index}`)
            taskIds.push(present(created.data, "createTask data").createTask.taskId)
        }
        const overCap = await createTask(`${run}-over-cap`)
        expect(overCap.errorCode).toBe("TASK_PLAN_CAP_EXCEEDED")
        expect(overCap.errors?.[0]?.extensions).toMatchObject({ params: { cap: FREE_CAP, upgradePath: "/plan/usage" } })
        expect(overCap.data).toBeNull()
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP })

        // Upgrade: checkout starts through the gateway. A pending subscription still reads as free: the cap keeps biting
        // until the gateway confirmation lands.
        const upgraded = await caller.mutate<UpgradePlanData>("upgradePlan")
        expect(upgraded.errorCode).toBeNull()
        const checkout = present(upgraded.data, "upgradePlan data").upgradePlan
        expect(checkout.status).toBe("pending")
        expect(stack.gateway.intentCalls).toHaveLength(1)
        const intentCall = present(stack.gateway.intentCalls[0], "the gateway create-intent call")
        expect(intentCall.reference).toBe(checkout.subscriptionId)
        expect(intentCall.authorization).toMatch(/^Bearer .+/)
        expect(checkout.checkoutUrl).toBe(`${stack.gateway.baseUrl}/checkout/${intentCall.gatewayIntentId}`)
        const intentRows = await database.paymentIntentById(checkout.paymentIntentId)
        expect(intentRows).toEqual([
            {
                id: checkout.paymentIntentId,
                subscription_id: checkout.subscriptionId,
                gateway_intent_id: intentCall.gatewayIntentId,
                status: "pending",
            },
        ])
        expect((await database.subscriptionsOfPerson(owner.personId)).map((row) => row.status)).toEqual(["pending"])
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP })
        expect((await createTask(`${run}-still-pending`)).errorCode).toBe("TASK_PLAN_CAP_EXCEEDED")

        // The gateway half, through the real door. A delivery without the shared secret is ignored, and the pending row is
        // untouched.
        const periodEnd = new Date(Date.now() + 30 * DAY_MS).toISOString()
        const unsigned = await webhook("Bearer not-the-shared-secret", intentCall.gatewayIntentId, periodEnd)
        expect(unsigned.status).toBe(200)
        expect(unsigned.body).toEqual({ ignored: true })
        expect((await database.subscriptionsOfPerson(owner.personId)).map((row) => row.status)).toEqual(["pending"])

        // The delivery signed with the shared secret applies the confirmation.
        const signed = await webhook(`Bearer ${stack.webhookSecret}`, intentCall.gatewayIntentId, periodEnd)
        expect(signed.status).toBe(200)
        expect(signed.body).toEqual({ ignored: false, applied: true, subscriptionStatus: "active" })
        const paidIntent = await database.paymentIntentById(checkout.paymentIntentId)
        expect(paidIntent[0]?.status).toBe("paid")
        expect(await database.subscriptionsOfPerson(owner.personId)).toEqual([{ id: checkout.subscriptionId, plan: "paid", status: "active" }])

        // A replay of the same delivery is ignored: the inbox claim already holds it.
        const replay = await webhook(`Bearer ${stack.webhookSecret}`, intentCall.gatewayIntentId, periodEnd)
        expect(replay.status).toBe(200)
        expect(replay.body).toEqual({ ignored: true })

        // Paid: no cap, over-cap creates succeed now.
        expect(await usageNow()).toEqual({ plan: "paid", cap: null, activeCount: FREE_CAP })
        for (let index = 1; index <= 2; index += 1) {
            expect((await createTask(`${run}-paid-${index}`)).errorCode).toBeNull()
        }
        expect(await usageNow()).toEqual({ plan: "paid", cap: null, activeCount: FREE_CAP + 2 })

        // Downgrade: accepted immediately, no task row touched; the freeze lands on the next create, computed from the real
        // count (22 > 20 -> refused).
        const downgraded = await caller.mutate<DowngradePlanData>("downgradePlan")
        expect(downgraded.errorCode).toBeNull()
        expect(downgraded.data?.downgradePlan).toMatchObject({ plan: "free", status: "free" })
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP + 2 })
        const frozen = await createTask(`${run}-frozen`)
        expect(frozen.errorCode).toBe("TASK_PLAN_CAP_EXCEEDED")
        expect(frozen.data).toBeNull()

        // The cap counts active tasks only: completing three drops to 19 and creation opens again.
        for (const taskId of taskIds.slice(0, 3)) {
            const completed = await caller.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
            expect(completed.errorCode).toBeNull()
        }
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP - 1 })
        const afterComplete = await createTask(`${run}-after-complete`)
        expect(afterComplete.errorCode).toBeNull()
    }, 300_000)
})
