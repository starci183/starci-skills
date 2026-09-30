import { randomUUID } from "node:crypto"
import { TaskErrorCode } from "@modules/domain/task"
import { PAYMENT_INTENT_BY_ID, SUBSCRIPTIONS_OF_PERSON } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { PaymentIntentRow, SubscriptionRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    CompleteTaskData,
    CreateTaskData,
    DowngradePlanData,
    PlanUsageData,
    UpgradePlanData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { worldClock } from "@tests/world/kit/world-clock"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

const FREE_CAP = 20
const DAY_MS = 86_400_000

/**
 * fr.plan.* as one A->Z journey over the real api: the free cap bites at 20 active tasks, checkout starts through the
 * payment gateway (the real SePay client talks to the gateway fake at the network edge), the gateway confirmation arrives as
 * a webhook the fake delivers to the signed door over HTTP, the cap lifts under the paid plan, and downgrade restores the cap
 * (accept-and-freeze: no task row is touched, the cap guard simply starts refusing creates again from the real count).
 *
 * The webhook door is exercised for real: a delivery signed with a wrong secret is ignored and leaves the pending row
 * untouched, the correctly signed delivery activates the subscription, and a replay of the same delivery is ignored again
 * (the inbox claim). Nothing is seeded out-of-band: every row is written by the api.
 */
describe("plan journey (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("free cap refuses -> upgrade checkout -> gateway confirm -> cap lifts -> downgrade freezes -> completing below the cap reopens creation", async () => {
        const run = `e2e-plan-${randomUUID()}`
        const owner = await world.signedInPerson("plan")
        const caller = owner.caller

        const usageNow = async (): Promise<PlanUsageData["planUsage"] | undefined> => {
            const observed = await caller.graphql<PlanUsageData>("planUsage")
            return observed.data?.planUsage
        }
        const createTask = (title: string) => caller.graphql<CreateTaskData>("createTask", { input: { title } })
        const subscriptionStatuses = async (): Promise<Array<string>> => {
            const rows: Array<SubscriptionRow> = await world.db.primary.query(SUBSCRIPTIONS_OF_PERSON, [owner.personId])
            return rows.map((row) => row.status)
        }

        // Baseline: a new person starts on the free plan, cap 20, nothing active.
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: 0 })

        // Fill the cap; the (cap+1)-th create is refused before anything is written, with the cap and the upgrade path as params.
        const taskIds: Array<string> = []
        for (let index = 1; index <= FREE_CAP; index += 1) {
            const created = await createTask(`${run}-cap-${index}`)
            taskIds.push(created.data?.createTask.taskId ?? "")
        }
        const overCap = await createTask(`${run}-over-cap`)
        expect(overCap.errorCode).toBe(TaskErrorCode.PlanCapExceeded)
        expect(overCap.errors?.[0]?.extensions).toMatchObject({ params: { cap: FREE_CAP, upgradePath: "/plan/usage" } })
        expect(overCap.data).toBeNull()
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP })

        // Upgrade: checkout starts through the gateway. A pending subscription still reads as free: the cap keeps biting
        // until the gateway confirmation lands.
        const upgraded = await caller.graphql<UpgradePlanData>("upgradePlan")
        expect(upgraded.errorCode).toBeNull()
        const checkout = upgraded.data?.upgradePlan
        expect(checkout?.status).toBe("pending")
        const intents = await world.fake.sepay.intents()
        const intent = intents.find((candidate) => candidate.reference === checkout?.subscriptionId)
        expect(intent?.checkoutUrl).toBe(checkout?.checkoutUrl)
        const gatewayIntentId = intent?.gatewayIntentId ?? ""
        // The contract of the create-intent call: what the gateway received from the real client.
        const intentCall = (await world.fake.sepay.requests()).find((request) => request.method === "POST" && request.body.includes(checkout?.subscriptionId ?? ""))
        expect(intentCall?.path).toBe("/userapi/transactions/qr")
        expect(intentCall?.headers.authorization).toMatch(/^Bearer .+/)
        const intentRows: Array<PaymentIntentRow> = await world.db.primary.query(PAYMENT_INTENT_BY_ID, [checkout?.paymentIntentId])
        expect(intentRows).toEqual([
            {
                id: checkout?.paymentIntentId,
                subscription_id: checkout?.subscriptionId,
                gateway_intent_id: gatewayIntentId,
                status: "pending",
            },
        ])
        expect(await subscriptionStatuses()).toEqual(["pending"])
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP })
        expect((await createTask(`${run}-still-pending`)).errorCode).toBe(TaskErrorCode.PlanCapExceeded)

        // The gateway half, through the real door. A delivery signed with a wrong secret is ignored, and the pending row is
        // untouched.
        const periodEnd = new Date(worldClock.now().getTime() + 30 * DAY_MS).toISOString()
        await world.fake.sepay.failNext({ badSignature: true })
        const unsigned = await world.fake.sepay.settle({ gatewayIntentId, status: "paid", periodEnd })
        expect(unsigned).toMatchObject({ signature: "invalid", httpStatus: 200, body: { ignored: true } })
        expect(await subscriptionStatuses()).toEqual(["pending"])

        // The delivery signed with the shared secret applies the confirmation.
        const signed = await world.fake.sepay.settle({ gatewayIntentId, status: "paid", periodEnd })
        expect(signed).toMatchObject({ signature: "valid", httpStatus: 200, body: { ignored: false, applied: true, subscriptionStatus: "active" } })
        const paidIntent: Array<PaymentIntentRow> = await world.db.primary.query(PAYMENT_INTENT_BY_ID, [checkout?.paymentIntentId])
        expect(paidIntent[0]?.status).toBe("paid")
        const subscriptions: Array<SubscriptionRow> = await world.db.primary.query(SUBSCRIPTIONS_OF_PERSON, [owner.personId])
        expect(subscriptions).toEqual([{ id: checkout?.subscriptionId, plan: "paid", status: "active" }])

        // A replay of the same delivery is ignored: the inbox claim already holds it.
        const replay = await world.fake.sepay.replayWebhook(gatewayIntentId)
        expect(replay).toMatchObject({ signature: "valid", httpStatus: 200, body: { ignored: true } })

        // Paid: no cap, over-cap creates succeed now.
        expect(await usageNow()).toEqual({ plan: "paid", cap: null, activeCount: FREE_CAP })
        for (let index = 1; index <= 2; index += 1) {
            expect((await createTask(`${run}-paid-${index}`)).errorCode).toBeNull()
        }
        expect(await usageNow()).toEqual({ plan: "paid", cap: null, activeCount: FREE_CAP + 2 })

        // Downgrade: accepted immediately, no task row touched; the freeze lands on the next create, computed from the real
        // count (22 > 20 -> refused).
        const downgraded = await caller.graphql<DowngradePlanData>("downgradePlan")
        expect(downgraded.errorCode).toBeNull()
        expect(downgraded.data?.downgradePlan).toMatchObject({ plan: "free", status: "free" })
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP + 2 })
        const frozen = await createTask(`${run}-frozen`)
        expect(frozen.errorCode).toBe(TaskErrorCode.PlanCapExceeded)
        expect(frozen.data).toBeNull()

        // The cap counts active tasks only: completing three drops to 19 and creation opens again.
        for (const taskId of taskIds.slice(0, 3)) {
            const completed = await caller.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
            expect(completed.errorCode).toBeNull()
        }
        expect(await usageNow()).toEqual({ plan: "free", cap: FREE_CAP, activeCount: FREE_CAP - 1 })
        const afterComplete = await createTask(`${run}-after-complete`)
        expect(afterComplete.errorCode).toBeNull()
    }, 300_000)
})
