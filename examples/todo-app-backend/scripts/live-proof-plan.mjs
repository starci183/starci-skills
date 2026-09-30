// Live proof for the plan feature, run against the real Keycloak/Postgres dev stack (never fakes).
// Exits non-zero on the first mismatch, naming the step that failed. This is the evidence source for:
// br.plan.caps.limit, br.plan.active-scope, br.plan.downgrade.freeze, fr.plan.usage.view (backend half),
// gap.plan.cap-guard-not-wired, contract.plan.create-precondition (the real create path).
//
// integration.plan.sepay stays todo (gap.plan.sepay-not-reachable): SEPAY_API_KEY_FILE decrypts to a
// DEMO-ONLY placeholder (see .starcistacks/dev/runtime/env/KEYS.md), never a real SePay sandbox
// credential, so this script probes the upgradePlan mutation's real create-intent call as a best-effort,
// NON-FATAL step that only reports whether SePay was actually reachable - it never asserts success or
// failure there, and never fakes a live pass for that leg. fr.plan.upgrade/reconcile's live proof stays
// unrun for that reason.
//
// Usage:
//   node scripts/live-proof-plan.mjs
//   API_URL=http://localhost:3103 node scripts/live-proof-plan.mjs
//   DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/live-proof-plan.mjs
//
// Prerequisites: the dev compose stack is up (postgres, keycloak) - reused read-only from another lane
// if already running - and this lane's own api is up on its own port against its own database
// (PORT=3103 PRIMARY_DB_URL=postgres://postgres:postgres@localhost:5432/todo_plan ... npm run start:dev).
import {
    COMPLETE_TASK, CREATE_TASK, DELETE_TASK, LIST_TASKS, createProof, env, run,
} from "./live-proof-lib.mjs"

const PLAN_USAGE = "query { planUsage { plan cap activeCount } }"
const UPGRADE_PLAN = "mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }"
const DOWNGRADE_PLAN = "mutation { downgradePlan { subscriptionId plan status } }"

const apiUrl = env("API_URL", "http://localhost:3103")
const demoEmail = env("DEMO_EMAIL", "plan-demo@todo.dev")
const demoPassword = env("DEMO_PASSWORD", "todo-demo-pass")

await run(async () => {
    const proof = createProof("live-proof-plan", apiUrl)
    const { graphql, step, pass, assertSuccess, assertRefused, assert } = proof
    const createdTaskIds = []
    let token = ""

    try {
        step("signIn plan-demo -> sessionToken")
        token = await proof.signIn(demoEmail, demoPassword)
        pass()

        // fr.plan.usage.view (backend half): a fresh person reads free, cap 20
        step("planUsage before any tasks -> free, cap 20")
        const usage = await graphql(PLAN_USAGE, {}, token)
        assertSuccess(usage)
        assert(usage.field("planUsage", "plan") === "free", `expected plan free: ${usage.text}`)
        assert(usage.field("planUsage", "cap") === "20", `expected cap 20: ${usage.text}`)
        pass()

        // br.plan.caps.limit / br.plan.active-scope: create 20 tasks, the 21st is refused
        step("creating 20 active tasks")
        for (let index = 1; index <= 20; index += 1) {
            const created = await graphql(CREATE_TASK, { input: { title: `plan live-proof task ${index}` } }, token)
            assertSuccess(created)
            createdTaskIds.push(created.field("createTask", "taskId"))
        }
        pass()

        step("planUsage at 20 -> activeCount 20")
        const full = await graphql(PLAN_USAGE, {}, token)
        assertSuccess(full)
        assert(full.field("planUsage", "activeCount") === "20", `expected activeCount 20: ${full.text}`)
        pass()

        step("ac.plan.caps.limit.refuses-over-cap: creating a 21st task is refused, naming the cap and the upgrade path")
        const overCap = await graphql(CREATE_TASK, { input: { title: "the 21st task" } }, token)
        assertRefused(overCap, "PLAN_CAP_EXCEEDED")
        assert(/20.*Upgrade/s.test(overCap.errorMessage), `refusal does not name the cap and the upgrade path: ${overCap.errorMessage}`)
        pass()

        // contract.plan.create-precondition: nothing was written by the refused create
        step("tasks query still shows exactly 20 (nothing written by the refused create)")
        const tasks = await graphql(LIST_TASKS, {}, token)
        assertSuccess(tasks)
        assert(tasks.body.data.tasks.length === 20, `expected exactly 20 tasks, got ${tasks.body.data.tasks.length}: ${tasks.text}`)
        pass()

        // best-effort, NON-FATAL: probe SePay reachability through the real upgradePlan mutation.
        // integration.plan.sepay / gap.plan.sepay-not-reachable: SEPAY_API_KEY_FILE is a DEMO-ONLY placeholder
        // (.starcistacks/dev/runtime/env/KEYS.md), so this call is expected to fail from this dev box. It is
        // never asserted pass/fail; only its outcome is reported, so this script never fakes a live pass for
        // the integration and never blocks the rest of the proof on it.
        step("upgradePlan (best-effort probe of the real SePay sandbox call, non-fatal)")
        const upgrade = await graphql(UPGRADE_PLAN, {}, token)
        process.stdout.write(upgrade.hasErrors
            ? `   sepay not reachable from this host (expected - demo-only placeholder key): ${upgrade.text}\n`
            : `   SEPAY REACHABLE: upgradePlan succeeded for real: ${upgrade.text}\n`)

        // br.plan.downgrade.freeze / decision.plan.downgrade.policy: downgrade is accepted immediately
        // (an idempotent no-op here: this person never activated a paid subscription, so it stays free. The
        // active and past-due paths need a paid subscription this live run cannot create without a reachable
        // gateway; they are unit-proven).
        step("downgradePlan -> accepted immediately, subscription stays free")
        const downgrade = await graphql(DOWNGRADE_PLAN, {}, token)
        assertSuccess(downgrade)
        assert(downgrade.field("downgradePlan", "status") === "free", `expected status free: ${downgrade.text}`)
        pass()

        // completing one task frees a slot under the cap
        step("completing one task frees a slot under the cap (br.plan.active-scope is re-checked live, not cached)")
        assertSuccess(await graphql(COMPLETE_TASK, { id: createdTaskIds[0] }, token))
        const again = await graphql(CREATE_TASK, { input: { title: "the 21st task, now allowed" } }, token)
        assertSuccess(again)
        createdTaskIds.push(again.field("createTask", "taskId"))
        pass()

        proof.finish("asserted steps passed")
    } finally {
        if (token) {
            for (const id of createdTaskIds) {
                if (id) await graphql(DELETE_TASK, { id }, token).catch(() => undefined)
            }
        }
    }
})
