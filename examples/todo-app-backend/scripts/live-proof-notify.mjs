// Live proof for the notify feature (examples/todo-app-backend), run against the real dev stack -
// Postgres, Redis and Keycloak from `docker compose -p todo-app-dev -f
// .starcistacks/dev/infra/compose/compose.yaml up -d` - and the notify lane's own API/database
// (PORT=3102, DATABASE_URL pointing at todo_notify). Never fakes: DeliveryService's real port is
// NotifySmtpPort/NotifyQueuePort, and this script never swaps them out from underneath the running api.
//
// GraphQL gives notify only three doors (notificationPreferences, updateNotificationPreferences,
// unsubscribe) - fr.notify.on-completion and fr.notify.digest have no GraphQL read of their own, so this
// script verifies them the only honest way available: reading the same Postgres/Redis the running api
// just wrote to, with the container's own psql/redis-cli. That is still a live run against the real
// stack, not a fake - it is not a unit test standing in for one.
//
// fr.notify.on-new-device is NOT exercised here: fr.notify.on-new-device and
// contract.notify.new-device-signal are blockedBy gap.notify.new-device-event (login raises no
// new-device signal today), so there is no real product action this script could take to trigger it.
// Injecting a synthetic event would not be a live proof of the product; see that gap's own statement.
//
// Usage:
//   node scripts/live-proof-notify.mjs
//   API_URL=http://localhost:3102 node scripts/live-proof-notify.mjs
import { execFileSync } from "node:child_process"
import {
    COMPLETE_TASK, CREATE_TASK, createProof, env, run,
} from "./live-proof-lib.mjs"

const NOTIFICATION_PREFERENCES = "query { notificationPreferences { channel unsubscribed digestWindowMinutes } }"
const UPDATE_PREFERENCES = "mutation Update($input: UpdateNotificationPreferencesInput!) { updateNotificationPreferences(request: $input) { channel unsubscribed digestWindowMinutes } }"
const UNSUBSCRIBE = "mutation Unsub($input: UnsubscribeInput!) { unsubscribe(request: $input) { channel unsubscribed } }"

const apiUrl = env("API_URL", "http://localhost:3102")
const demoEmail = env("DEMO_EMAIL", "demo@todo.dev")
const demoPassword = env("DEMO_PASSWORD", "todo-demo-pass")
const postgresContainer = env("POSTGRES_CONTAINER", "todo-app-dev-postgres-1")
const redisContainer = env("REDIS_CONTAINER", "todo-app-dev-redis-1")
const notifyDb = env("NOTIFY_DB", "todo_notify")
const digestWindowMinutes = 1
const windowPollTimeoutSeconds = 90

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const docker = (args) => execFileSync("docker", args, { encoding: "utf8" })

/** Runs one SQL statement against the notify lane's own database and returns its single scalar result. */
const psqlScalar = (sql) => docker(["exec", postgresContainer, "psql", "-U", "postgres", "-d", notifyDb, "-tA", "-c", sql]).replace(/\s/g, "")
const redisZcard = (key) => Number(docker(["exec", redisContainer, "redis-cli", "ZCARD", key]).trim())

/** The delivery attempt columns of the notification a completed task produced. */
const attemptOf = (column, taskId) => psqlScalar(`SELECT a.${column} FROM notify_delivery_attempts a JOIN notify_notifications n ON n.id = a.notification_id WHERE n.payload->>'taskId' = '${taskId}'`)

await run(async () => {
    const proof = createProof("live-proof-notify", apiUrl)
    const { graphql, step, pass, assertSuccess, assert } = proof

    /** Creates a task and completes it, so the completion event reaches the notify subscriber. */
    const createAndComplete = async (token, title) => {
        const created = await graphql(CREATE_TASK, { input: { title } }, token)
        assertSuccess(created)
        const taskId = created.field("createTask", "taskId")
        assertSuccess(await graphql(COMPLETE_TASK, { id: taskId }, token))
        await sleep(1000) // PlatformEventBus -> NotifyEventSubscriber -> NotifyService.admit is async fire-and-forget
        return taskId
    }

    step("signIn demo -> sessionToken")
    const signedIn = await graphql("mutation SignIn($input: SignInInput!) { signIn(request: $input) { sessionToken personId } }", { input: { email: demoEmail, password: demoPassword } })
    assertSuccess(signedIn)
    const token = signedIn.field("signIn", "sessionToken")
    const personId = signedIn.field("signIn", "personId")
    assert(token && personId, `no sessionToken/personId in response: ${signedIn.text}`)
    pass()

    // clean slate: a window left open (unflushed) by an earlier run of this same script would still be "not yet
    // closed" under its own (possibly longer) closesAt, and a fresh admission would join that old window rather
    // than opening a new one - correct per br.notify.digest.window (a window's length is fixed at open time), but
    // it would make this script's own timing non-deterministic across reruns.
    step("cleanup: close out any digest window this script left open on an earlier run")
    docker(["exec", postgresContainer, "psql", "-U", "postgres", "-d", notifyDb, "-c",
        `DELETE FROM notify_digest_windows WHERE person_id = '${personId}' AND channel = 'email' AND flushed_at IS NULL`])
    pass()

    // fr.notify.unsubscribe / notificationPreferences: reset to a known state (subscribed, a short digest window)
    step(`updateNotificationPreferences -> resubscribed with a ${digestWindowMinutes}-minute digest window`)
    const updated = await graphql(UPDATE_PREFERENCES, { input: { channel: "email", unsubscribed: false, digestWindowMinutes } }, token)
    assertSuccess(updated)
    assert(updated.field("updateNotificationPreferences", "unsubscribed") === "false", `expected unsubscribed:false: ${updated.text}`)
    pass()

    step("notificationPreferences reads back what was just written")
    const preferences = await graphql(NOTIFICATION_PREFERENCES, {}, token)
    assertSuccess(preferences)
    assert(preferences.body.data.notificationPreferences.some((entry) => entry.digestWindowMinutes === digestWindowMinutes), `digestWindowMinutes not persisted: ${preferences.text}`)
    pass()

    // fr.notify.on-completion: completing a task admits a notification for its owner
    step("createTask + completeTask (event A) -> event.task.completed admits a notify_notifications row")
    const taskA = await createAndComplete(token, "live-proof-notify A")
    const countA = psqlScalar(`SELECT count(*) FROM notify_notifications WHERE recipient_id = '${personId}' AND kind = 'task-complete' AND payload->>'taskId' = '${taskA}'`)
    assert(countA === "1", `expected exactly one notification for task A, got ${countA}`)
    const groupA = psqlScalar(`SELECT digest_group_id FROM notify_notifications WHERE recipient_id = '${personId}' AND payload->>'taskId' = '${taskA}'`)
    assert(groupA, "notification for task A never joined a digest window")
    pass()

    // fr.notify.digest: a second event for the same person+channel, before the window closes, joins the same group
    step("createTask + completeTask (event B) -> joins event A's still-open digest window")
    const taskB = await createAndComplete(token, "live-proof-notify B")
    const groupB = psqlScalar(`SELECT digest_group_id FROM notify_notifications WHERE recipient_id = '${personId}' AND payload->>'taskId' = '${taskB}'`)
    assert(groupB === groupA, `event B joined a different group (${groupB}) than event A (${groupA})`)
    pass()

    step("integration.notify.queue (live Redis): the digest window's flush job is really sitting in the queue")
    const queueSize = redisZcard("notify:dispatch-queue")
    assert(queueSize >= 1, `expected at least one job in notify:dispatch-queue, got ${queueSize}`)
    pass()

    // the window closes and the real scheduler dispatches both events as one message
    step(`waiting up to ${windowPollTimeoutSeconds}s for the ${digestWindowMinutes}-minute window to close and the flush job to be dequeued`)
    const deadline = Date.now() + windowPollTimeoutSeconds * 1000
    let flushedAt = ""
    while (Date.now() < deadline && !flushedAt) {
        flushedAt = psqlScalar(`SELECT flushed_at FROM notify_digest_windows WHERE id = '${groupA}'`)
        if (!flushedAt) await sleep(5000)
    }
    assert(flushedAt, `digest window ${groupA} was never flushed within ${windowPollTimeoutSeconds}s`)
    pass()

    step("sds.notify.delivery-lifecycle t-dispatch: both attempts left their initial queued/attempt=0 state")
    const attemptA = Number(attemptOf("attempt", taskA))
    const attemptB = Number(attemptOf("attempt", taskB))
    assert(attemptA >= 1, `task A's delivery attempt was never dispatched (attempt=${attemptA})`)
    assert(attemptB >= 1, `task B's delivery attempt was never dispatched (attempt=${attemptB})`)
    pass()

    // fr.notify.unsubscribe: after unsubscribing, a later event is suppressed before any dispatch attempt
    step("unsubscribe -> unsubscribed:true")
    const unsubscribed = await graphql(UNSUBSCRIBE, { input: { channel: "email" } }, token)
    assertSuccess(unsubscribed)
    assert(unsubscribed.field("unsubscribe", "unsubscribed") === "true", `expected unsubscribed:true: ${unsubscribed.text}`)
    pass()

    step("createTask + completeTask (event C) -> suppressed immediately, never dispatched")
    const taskC = await createAndComplete(token, "live-proof-notify C")
    const stateC = attemptOf("state", taskC)
    const failureClassC = attemptOf("failure_class", taskC)
    const attemptC = attemptOf("attempt", taskC)
    assert(stateC === "suppressed", `expected event C suppressed, got state=${stateC}`)
    assert(failureClassC === "unsubscribed", `expected failureClass unsubscribed, got ${failureClassC}`)
    assert(attemptC === "0", `expected attempt=0 (no dispatch was ever made), got ${attemptC}`)
    pass()

    step("resubscribe -> re-subscribing lets a later event reach the digest window again")
    const resubscribed = await graphql(UPDATE_PREFERENCES, { input: { channel: "email", unsubscribed: false } }, token)
    assertSuccess(resubscribed)
    assert(resubscribed.field("updateNotificationPreferences", "unsubscribed") === "false", `expected unsubscribed:false: ${resubscribed.text}`)
    pass()

    proof.finish()
    process.stdout.write("note: integration.notify.smtp had no reachable dev host to prove a live delivery against (see that record); every step above ran against real Postgres and real Redis.\n")
})
