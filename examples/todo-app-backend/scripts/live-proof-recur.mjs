// Live proof for the recur feature, run against the real dev stack (Postgres + Keycloak) and the real
// API - never fakes. Exits non-zero on the first mismatch, naming the step that failed. This is the
// evidence source for: fr.recur.make-recurring, fr.recur.edit-rule, fr.recur.end-rule,
// fr.recur.see-upcoming, and (the materialisation step) integration.recur.scheduler's own live tick.
//
// Usage:
//   API_URL=http://localhost:3105 node scripts/live-proof-recur.mjs
//   DEMO_EMAIL=... DEMO_PASSWORD=... DEMO2_EMAIL=... DEMO2_PASSWORD=... node scripts/live-proof-recur.mjs
//
// Prerequisites: the dev compose stack is up (postgres, keycloak) and this feature's own API instance is
// running on its own lane port against its own database, e.g.:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5432/todo_recur PORT=3105 \
//     RECUR_TICK_CRON='*/5 * * * * *' node dist/apps/todo/src/main.js
// RECUR_TICK_CRON is only set for this proof so integration.recur.scheduler's own tick fires every 5
// seconds instead of every 5 minutes (the endpoint integration.recur.scheduler declares,
// AppConfigService's own default) - this script waits for a *real* tick to materialise a real occurrence,
// never a manually invoked stand-in for one, so a fast tick is what makes that wait practical here.
import {
    createProof, env, run,
} from "./live-proof-lib.mjs"

const MAKE_RECURRING = "mutation M($input: MakeRecurringInput!) { makeRecurring(request: $input) { ruleId title frequency timeZone time startDate } }"
const EDIT_RECURRENCE = "mutation M($input: EditRecurrenceInput!) { editRecurrence(request: $input) { ruleId frequency timeZone time } }"
const END_RECURRENCE = "mutation M($input: EndRecurrenceInput!) { endRecurrence(request: $input) { ruleId endedAt orphanedCount } }"
const UPCOMING = "query Q($input: UpcomingOccurrencesRequest!) { upcomingOccurrences(request: $input) { ruleId materialised { occurrenceId localDate status } previewDates } }"

const apiUrl = env("API_URL", "http://localhost:3105")
const demoEmail = env("DEMO_EMAIL", "demo@todo.dev")
const demoPassword = env("DEMO_PASSWORD", "todo-demo-pass")
const demo2Email = env("DEMO2_EMAIL", "demo2@todo.dev")
const demo2Password = env("DEMO2_PASSWORD", "todo-demo-pass-2")
const tickTimeoutSeconds = Number(env("TICK_TIMEOUT_SECONDS", "90"))
const today = new Date().toISOString().slice(0, 10)

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const isWeekend = (date) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())

await run(async () => {
    const proof = createProof("live-proof-recur", apiUrl)
    const { graphql, step, pass, assertSuccess, assertRefused, assert } = proof

    step("signIn demo -> sessionToken")
    const token1 = await proof.signIn(demoEmail, demoPassword)
    pass()

    step("signIn demo2 -> sessionToken")
    const token2 = await proof.signIn(demo2Email, demo2Password)
    pass()

    // fr.recur.make-recurring
    step(`makeRecurring (every-weekday, Europe/Berlin, 09:00, startDate=${today}) -> ruleId`)
    const made = await graphql(MAKE_RECURRING, {
        input: { title: "live-proof recur rule", frequency: "EveryWeekday", timeZone: "Europe/Berlin", time: "09:00", startDate: today },
    }, token1)
    assertSuccess(made)
    const ruleId = made.field("makeRecurring", "ruleId")
    assert(ruleId, `no ruleId in response: ${made.text}`)
    pass()

    // fr.recur.see-upcoming (before generation): the preview never lands on a weekend
    step("upcomingOccurrences before generation -> previewDates has no weekend date")
    const preview = await graphql(UPCOMING, { input: { ruleId } }, token1)
    assertSuccess(preview)
    assert(!preview.body.data.upcomingOccurrences.previewDates.some(isWeekend), `previewDates contains a weekend date: ${preview.text}`)
    pass()

    // exceptionFlows: someone who is not the rule's owner may not edit it
    step("demo2 attempts editRecurrence on demo's rule -> RECUR_RULE_FORBIDDEN")
    assertRefused(await graphql(EDIT_RECURRENCE, { input: { ruleId, time: "11:00" } }, token2), "RECUR_RULE_FORBIDDEN")
    pass()

    // integration.recur.scheduler: wait for a REAL tick to materialise today's occurrence (never a manually
    // invoked stand-in) - requires the API to have been started with a short RECUR_TICK_CRON.
    step(`waiting up to ${tickTimeoutSeconds}s for a real scheduler tick to materialise today's occurrence`)
    let materialised
    for (let elapsed = 0; elapsed < tickTimeoutSeconds && !materialised; elapsed += 3) {
        const poll = await graphql(UPCOMING, { input: { ruleId } }, token1)
        assertSuccess(poll)
        materialised = poll.body.data.upcomingOccurrences.materialised.find((occurrence) => occurrence.localDate === today)
        if (!materialised) await sleep(3000)
    }
    assert(materialised, `no occurrence materialised for ${today} within ${tickTimeoutSeconds}s - is the API running with a short RECUR_TICK_CRON?`)
    assert(materialised.status === "materialised", `materialised occurrence has unexpected status: ${JSON.stringify(materialised)}`)
    pass()

    // fr.recur.edit-rule
    step("editRecurrence (owner) -> new time")
    const edited = await graphql(EDIT_RECURRENCE, { input: { ruleId, time: "10:30" } }, token1)
    assertSuccess(edited)
    assert(edited.field("editRecurrence", "time") === "10:30", `time was not updated: ${edited.text}`)
    pass()

    // fr.recur.end-rule / br.recur.ending.preserves-history
    step(`endRecurrence effective ${today} (owner) -> endedAt, orphanedCount >= 1`)
    const ended = await graphql(END_RECURRENCE, { input: { ruleId, endedAt: today } }, token1)
    assertSuccess(ended)
    assert(ended.field("endRecurrence", "endedAt") === today, `endedAt was not set: ${ended.text}`)
    const orphanedCount = Number(ended.field("endRecurrence", "orphanedCount"))
    assert(orphanedCount >= 1, `expected at least one orphaned occurrence, got ${orphanedCount}: ${ended.text}`)
    pass()

    step("upcomingOccurrences after ending -> no preview, history kept as orphaned")
    const after = await graphql(UPCOMING, { input: { ruleId } }, token1)
    assertSuccess(after)
    assert(after.body.data.upcomingOccurrences.previewDates.length === 0, `an ended rule must show no upcoming preview: ${after.text}`)
    assert(after.text.includes("\"status\":\"orphaned\""), `expected the today occurrence to read orphaned: ${after.text}`)
    pass()

    proof.finish()
})
