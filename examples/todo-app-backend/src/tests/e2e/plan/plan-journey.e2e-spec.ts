import {
    randomUUID 
} from "node:crypto"
import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"
import {
    E2ESession 
} from "@tests/infra/bussiness/accounts/e2e-auth.service"
import {
    GraphqlObserved 
} from "@tests/infra/integrations/http/e2e-http.service"

jest.setTimeout(120_000)

/**
 * fr.plan.* as one A->Z journey over the run-owned stack: the free cap bites at 20 active tasks,
 * checkout starts, the gateway's confirmation path is exercised, the cap lifts under the paid plan,
 * and downgrade restores the cap (accept-and-freeze: no task row is touched, the cap guard simply
 * starts refusing creates again from the real count).
 *
 * Boundary honesty (gap.plan.sepay-not-reachable): SePay's create-intent endpoint answers no real
 * call today, so `upgradePlan` may legitimately come back as a GraphQL error in this stack; the spec
 * then first proves the app's ordering guarantee -- no pending subscription, no payment_intents row --
 * and seeds the pending checkout state out-of-band (the rows a completed create-intent would have
 * left). The webhook door is then called for real: the spawned api has no SEPAY_WEBHOOK_SECRET
 * provisioned, so the only honest public outcome is `{ignored: true}` -- fr.plan.upgrade's exception
 * flow itself, asserted against the still-pending row. With no public door able to produce it, the
 * gateway-confirmed state is seeded directly, and everything after is real: the effective-plan read,
 * the cap guard, downgrade, the freeze.
 */

const UPGRADE_PLAN =
  "mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }"
const DOWNGRADE_PLAN = "mutation { downgradePlan { subscriptionId plan status } }"

const FREE_CAP = 20 // plan-catalog.ts: FREE_PLAN_TASK_CAP
const RUN = `e2e-plan-${Date.now().toString(36)}`

interface PlanUsage {
  plan: string;
  cap: number | null;
  activeCount: number;
}

interface PaymentIntentRow {
  id: string;
  subscription_id: string;
  gateway_intent_id: string;
  status: string;
}

interface WebhookOutcome {
  applied?: boolean;
  ignored?: boolean;
  subscriptionStatus?: string;
}

describe("plan journey (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect(
                (await world.http.anonymous().get<{ status: string }>("/health")).data.status,
            ).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            // close() runs stack teardown: compose down -v plus the verified-gone check.
            await world.moduleRef.close()
        })

        const dataOf = <TData, K extends keyof TData>(
            observed: GraphqlObserved<TData>,
            operation: K,
        ): NonNullable<TData[K]> => {
            const data = observed.data?.[operation]
            if (data === null || data === undefined) {
                throw new Error(
                    `no data.${String(operation)} (${observed.errorCode ?? "no code"}: ` +
          `${observed.errorMessage ?? "no message"})`,
                )
            }
            return data as NonNullable<TData[K]>
        }

        it("free cap refuses → upgrade checkout → gateway confirm → cap lifts → downgrade freezes → completing below the cap reopens creation",
            async () => {
                const {
                    http, auth, stack 
                } = world
                const owner = await auth.persona("owner")
                const token = owner.token

                const usageAt = () =>
                    http
                        .graphql<{ planUsage: PlanUsage }>("usage",
                            {
                                token 
                            })
                        .then(observed => dataOf(observed,
                            "planUsage"))
                const createTask = (title: string) =>
                    http.graphql<{ createTask: { taskId: string } }>(
                        "createTask",
                        {
                            variables: {
                                input: {
                                    title 
                                } 
                            }, token 
                        },
                    )

                // Baseline: the seeded demo identity starts on the free plan, cap 20, nothing active.
                expect(await usageAt()).toEqual({
                    plan: "free", cap: FREE_CAP, activeCount: 0 
                })

                // Fill the cap; the (cap+1)-th create is refused before anything is written.
                const taskIds: Array<string> = []
                for (let i = 1; i <= FREE_CAP; i += 1) {
                    const created = dataOf(await createTask(`${RUN}-cap-${i}`),
                        "createTask")
                    expect(created.taskId).toBeTruthy()
                    taskIds.push(created.taskId)
                }
                const overCap = await createTask(`${RUN}-over-cap`)
                expect(overCap.errorCode).toBe("PLAN_CAP_EXCEEDED")
                expect(overCap.data).toBeNull()
                expect(await usageAt()).toEqual({
                    plan: "free", cap: FREE_CAP, activeCount: FREE_CAP 
                })

                // Upgrade: start checkout. A pending subscription still reads as free -- the cap keeps biting
                // until the gateway's own confirmation lands.
                const gatewayIntentId = await startCheckout(owner)
                expect(await usageAt()).toEqual({
                    plan: "free", cap: FREE_CAP, activeCount: FREE_CAP 
                })
                expect((await createTask(`${RUN}-still-pending`)).errorCode).toBe("PLAN_CAP_EXCEEDED")

                // The gateway's half, through the real door: POST /webhooks/sepay. This stack's api carries no
                // webhook secret, so the honest answer is {ignored: true} -- the unsigned-delivery refusal --
                // and the pending row must be untouched. (If a future stack provisions a shared secret and
                // exposes it as E2E_SEPAY_WEBHOOK_SECRET, the same call applies t-gateway-confirmed for real.)
                const webhook = await fetch(`${stack.baseUrl}/webhooks/sepay`,
                    {
                        method: "POST",
                        headers: {
                            "content-type": "application/json",
                            authorization: `Bearer ${process.env.E2E_SEPAY_WEBHOOK_SECRET ?? "unsigned-e2e-delivery"}`,
                        },
                        body: JSON.stringify({
                            id: gatewayIntentId,
                            status: "paid",
                            periodEnd: new Date(Date.now() + 30 * 86_400_000).toISOString(),
                        }),
                    })
                const webhookBody = (await webhook.json()) as WebhookOutcome
                expect(webhook.status).toBe(200)
                await applyGatewayOutcome(webhookBody,
                    owner)

                // Paid: no cap, over-cap creates succeed now.
                expect(await usageAt()).toEqual({
                    plan: "paid", cap: null, activeCount: FREE_CAP 
                })
                for (let i = 1; i <= 2; i += 1) {
                    dataOf(await createTask(`${RUN}-paid-${i}`),
                        "createTask")
                }
                expect(await usageAt()).toEqual({
                    plan: "paid", cap: null, activeCount: FREE_CAP + 2 
                })

                // Downgrade: accepted immediately, no task row touched; the freeze lands on the next create,
                // computed from the real count (22 > 20 -> refused).
                const downgraded = dataOf(
                    await http.graphql<{ downgradePlan: { subscriptionId: string; plan: string; status: string } }>(
                        DOWNGRADE_PLAN,
                        {
                            token 
                        },
                    ),
                    "downgradePlan",
                )
                expect(downgraded).toMatchObject({
                    plan: "free", status: "free" 
                })
                expect(await usageAt()).toEqual({
                    plan: "free", cap: FREE_CAP, activeCount: FREE_CAP + 2 
                })
                const frozen = await createTask(`${RUN}-frozen`)
                expect(frozen.errorCode).toBe("PLAN_CAP_EXCEEDED")
                expect(frozen.data).toBeNull()

                // The cap counts active tasks only: completing three drops to 19 and creation opens again.
                for (const taskId of taskIds.slice(0,
                    3)) {
                    dataOf(
                        await http.graphql<{ completeTask: { taskId: string; complete: boolean } }>(
                            "completeTask",
                            {
                                variables: {
                                    id: taskId 
                                }, token 
                            },
                        ),
                        "completeTask",
                    )
                }
                expect(await usageAt()).toEqual({
                    plan: "free", cap: FREE_CAP, activeCount: FREE_CAP - 1 
                })
                const afterComplete = dataOf(await createTask(`${RUN}-after-complete`),
                    "createTask")
                expect(afterComplete.taskId).toBeTruthy()
            })

        /**
   * Reconcile the webhook door's answer with the subscription row. On the unsigned stack the honest
   * outcome is {ignored: true}: the pending row must be untouched, and since no public door can
   * produce t-gateway-confirmed here, the spec stands in for the gateway by writing the row exactly
   * as ConfirmPaymentHandler would have. On a stack carrying the shared secret the door applies the
   * transition itself, and the asserted outcome is the applied/active reply.
   */
        async function applyGatewayOutcome(webhookBody: WebhookOutcome,
            owner: E2ESession): Promise<void> {
            const {
                db, dataSource 
            } = world
            if (webhookBody.ignored === true) {
                const pending = await dataSource.query<Array<{ status: string }>>(
                    "select status from subscriptions where person_id = $1",
                    [owner.personId],
                )
                expect(pending[0]?.status).toBe("pending")
                // No public door can produce t-gateway-confirmed in this stack: stand in for the gateway by
                // writing the row exactly as ConfirmPaymentHandler would have.
                await db.query(
                    "update subscriptions set status = 'active', plan = 'paid', period_end = $2 where person_id = $1",
                    [owner.personId,
                        new Date(Date.now() + 30 * 86_400_000)],
                )
            } else {
                expect(webhookBody).toMatchObject({
                    applied: true, subscriptionStatus: "active" 
                })
            }
        }

        /**
   * upgradePlan's real call. When the run's gateway answers, returns the intent's gateway id read
   * back out of the ledger; when it does not (gap.plan.sepay-not-reachable), asserts the refusal
   * left nothing half-written, then seeds the pending checkout state -- the rows a completed
   * create-intent would have produced -- and returns the seeded gateway intent id.
   */
        async function startCheckout(owner: E2ESession): Promise<string> {
            const {
                http, db, dataSource 
            } = world
            const upgrade = await http.graphql<{
      upgradePlan: {
        subscriptionId: string;
        paymentIntentId: string;
        checkoutUrl: string;
        status: string;
      };
    }>(UPGRADE_PLAN,
        {
            token: owner.token 
        })

            const intentId = upgrade.data?.upgradePlan?.paymentIntentId
            if (intentId) {
                expect(upgrade.data?.upgradePlan?.status).toBe("pending")
                const rows = await dataSource.query<Array<PaymentIntentRow>>(
                    "select id, subscription_id, gateway_intent_id, status from payment_intents where id = $1",
                    [intentId],
                )
                expect(rows).toHaveLength(1)
                expect(rows[0].status).toBe("pending")
                return rows[0].gateway_intent_id
            }

            // Gateway refused the call: the handler's ordering (intent before t-checkout-started) means no
            // pending subscription and no payment_intents row may exist for this person.
            const intents = await dataSource.query<Array<PaymentIntentRow>>(
                `select pi.id, pi.subscription_id, pi.gateway_intent_id, pi.status
       from payment_intents pi join subscriptions s on s.id = pi.subscription_id
       where s.person_id = $1`,
                [owner.personId],
            )
            expect(intents).toHaveLength(0)
            const subscriptions = await dataSource.query<Array<{ id: string; status: string }>>(
                "select id, status from subscriptions where person_id = $1",
                [owner.personId],
            )
            for (const subscription of subscriptions) {
                expect(subscription.status).toBe("free")
            }

            const gatewayIntentId = `e2e-${randomUUID()}`
            await db.query(
                `insert into subscriptions (id, person_id, plan, status, period_end, gateway_customer_id)
       values ($1, $2, 'free', 'pending', null, null)
       on conflict (person_id) do update set status = 'pending'`,
                [randomUUID(),
                    owner.personId],
            )
            const [subscription] = await dataSource.query<Array<{ id: string }>>(
                "select id from subscriptions where person_id = $1",
                [owner.personId],
            )
            await db.query(
                `insert into payment_intents (id, subscription_id, gateway, gateway_intent_id, amount, currency, status, applied_at)
       values ($1, $2, 'sepay', $3, 99000, 'VND', 'pending', null)`,
                [randomUUID(),
                    subscription.id,
                    gatewayIntentId],
            )
            return gatewayIntentId
        }
    })
