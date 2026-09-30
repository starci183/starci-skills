// Live proof for the audit feature (fr.audit.log.append, fr.audit.erasure.request,
// fr.audit.erasure.complete, fr.audit.export), run against the real Keycloak/Postgres dev stack on this
// lane's own port and database (never fakes). Exits non-zero on the first mismatch, naming the step that
// failed. Structured exactly like scripts/live-proof.mjs: GraphQL operations against one endpoint, the
// outcome read from the JSON body (errors[] vs data.<op>), never the HTTP status code.
//
// Usage:
//   API_URL=http://localhost:3104 node scripts/live-proof-audit.mjs
//   DEMO_EMAIL=... DEMO_PASSWORD=... node scripts/live-proof-audit.mjs
//
// Prerequisites: the dev compose stack is up (postgres, keycloak) and this lane's own api is running on
// its own port against its own database (PRIMARY_DB_URL pointing at todo_audit). This script only talks
// HTTP to the running api; it does not start or stop anything itself.
import {
    CREATE_TASK, createProof, env, run,
} from "./live-proof-lib.mjs"

const AUDIT_LOG = "query { auditLog { at action target } }"
const EXPORT_MY_DATA = "query { exportMyData { at action target } }"
const REQUEST_ERASURE = "mutation { requestErasure { requestId state } }"
const COMPLETE_ERASURE = "mutation CompleteErasure($input: CompleteErasureRequest!) { completeErasure(request: $input) { requestId state } }"

const apiUrl = env("API_URL", "http://localhost:3104")
const demoEmail = env("DEMO_EMAIL", "demo@todo.dev")
const demoPassword = env("DEMO_PASSWORD", "todo-demo-pass")

await run(async () => {
    const proof = createProof("live-proof-audit", apiUrl)
    const { graphql, step, pass, assertSuccess, assert } = proof

    // fr.audit.log.append (via event.login.signed-in): signing in appends a login.signed-in line
    step("signIn demo -> sessionToken")
    const token = await proof.signIn(demoEmail, demoPassword)
    pass()

    step("auditLog (own lines) contains a login.signed-in line (fr.audit.log.append)")
    const firstLog = await graphql(AUDIT_LOG, {}, token)
    assertSuccess(firstLog)
    assert(firstLog.text.includes("\"action\":\"login.signed-in\""), `no login.signed-in line in auditLog: ${firstLog.text}`)
    pass()

    // fr.audit.log.append (via event.task.created): creating a task appends a task.created line
    step("createTask -> taskId")
    const created = await graphql(CREATE_TASK, { input: { title: "live-proof audit task" } }, token)
    assertSuccess(created)
    const taskId = created.field("createTask", "taskId")
    assert(taskId, `no taskId in response: ${created.text}`)
    pass()

    step("auditLog now contains a task.created line naming that task (fr.audit.log.append)")
    const secondLog = await graphql(AUDIT_LOG, {}, token)
    assertSuccess(secondLog)
    assert(secondLog.text.includes(`"action":"task.created","target":"${taskId}"`), `no matching task.created line: ${secondLog.text}`)
    pass()

    // fr.audit.export: before erasure, export returns this person's lines
    step("exportMyData returns this person's own lines before erasure (fr.audit.export)")
    const exported = await graphql(EXPORT_MY_DATA, {}, token)
    assertSuccess(exported)
    assert(exported.text.includes("\"action\":\"login.signed-in\""), `exportMyData missing expected line before erasure: ${exported.text}`)
    pass()

    // fr.audit.erasure.request: request -> verified (the session already proves identity)
    step("requestErasure -> state verified (fr.audit.erasure.request)")
    const requested = await graphql(REQUEST_ERASURE, {}, token)
    assertSuccess(requested)
    const requestId = requested.field("requestErasure", "requestId")
    assert(requestId, `no requestId in response: ${requested.text}`)
    assert(requested.field("requestErasure", "state") === "verified", `expected state verified: ${requested.text}`)
    pass()

    // fr.audit.erasure.complete: complete -> destroys the key, appends the completed line
    step("completeErasure -> state complete (fr.audit.erasure.complete)")
    const completed = await graphql(COMPLETE_ERASURE, { input: { requestId } }, token)
    assertSuccess(completed)
    assert(completed.field("completeErasure", "state") === "complete", `expected state complete: ${completed.text}`)
    pass()

    // fr.audit.export exceptionFlow: once the key is destroyed, export returns nothing
    step("exportMyData now returns nothing for the erased person (fr.audit.export exceptionFlow)")
    const exportedAfter = await graphql(EXPORT_MY_DATA, {}, token)
    assertSuccess(exportedAfter)
    assert(exportedAfter.text.includes("\"exportMyData\":[]"), `expected an empty exportMyData after erasure: ${exportedAfter.text}`)
    pass()

    // ac.audit.erasure.right.identifying-fields-unreadable: auditLog agrees (same keyId lookup)
    step("auditLog also returns nothing for the erased person (ac.audit.erasure.right.identifying-fields-unreadable)")
    const logAfter = await graphql(AUDIT_LOG, {}, token)
    assertSuccess(logAfter)
    assert(logAfter.text.includes("\"auditLog\":[]"), `expected an empty auditLog after erasure: ${logAfter.text}`)
    pass()

    proof.finish()
})
