// Live proof for the todo-app-backend example, run against the real Keycloak/Postgres dev stack (never
// fakes). Exits non-zero on the first mismatch, naming the step that failed. This is the evidence source
// for: integration.login.keycloak, integration.login.postgres, br.login.password.sign-in,
// br.task.complete.once, br.task.delete.final, br.task.list.owned.
//
// Usage:
//   node scripts/live-proof.mjs
//   API_URL=http://localhost:3001 node scripts/live-proof.mjs
//   DEMO_EMAIL=... DEMO_PASSWORD=... DEMO2_EMAIL=... DEMO2_PASSWORD=... node scripts/live-proof.mjs
//
// Prerequisites: the dev compose stack is up (postgres, keycloak, redis, minio, prometheus) and the api is
// running on the host (PORT=3001 node scripts/with-dev-secrets.mjs npm run start). This script only talks
// HTTP to the running api; it does not start or stop anything itself. The defaults below mirror the
// DEMO-ONLY users already committed in .starcistacks/dev/infra/compose/realm-todo.json.
import {
    COMPLETE_TASK, CREATE_TASK, DELETE_TASK, LIST_TASKS, REOPEN_TASK, SIGN_IN, SIGN_OUT, createProof, env, run,
} from "./live-proof-lib.mjs"

const apiUrl = env("API_URL", "http://localhost:3001")
const demoEmail = env("DEMO_EMAIL", "demo@todo.dev")
const demoPassword = env("DEMO_PASSWORD", "todo-demo-pass")
const demo2Email = env("DEMO2_EMAIL", "demo2@todo.dev")
const demo2Password = env("DEMO2_PASSWORD", "todo-demo-pass-2")
const origin = env("ORIGIN", "http://localhost:3000")

await run(async () => {
    const proof = createProof("live-proof", apiUrl)
    const { graphql, step, pass, assertSuccess, assertRefused, assert } = proof

    step("signIn demo (correct password) -> sessionToken")
    const token1 = await proof.signIn(demoEmail, demoPassword)
    pass()

    // br.login.password.sign-in: wrong password and unknown email refuse identically
    step("signIn wrong password -> INVALID_CREDENTIALS")
    const wrongPassword = await graphql(SIGN_IN, { input: { email: demoEmail, password: "wrong-password-xyz" } })
    assertRefused(wrongPassword, "INVALID_CREDENTIALS")
    pass()

    step("signIn unknown email -> INVALID_CREDENTIALS, identical to wrong password")
    const unknownEmail = await graphql(SIGN_IN, { input: { email: `nobody-${process.pid}@todo.dev`, password: "whatever" } })
    assertRefused(unknownEmail, "INVALID_CREDENTIALS")
    assert(unknownEmail.text === wrongPassword.text, `unknown-email body differs from wrong-password body: '${unknownEmail.text}' vs '${wrongPassword.text}'`)
    pass()

    // task CRUD
    step("createTask -> taskId")
    const created = await graphql(CREATE_TASK, { input: { title: "live-proof task" } }, token1)
    assertSuccess(created)
    const taskId = created.field("createTask", "taskId")
    assert(taskId, `no taskId in response: ${created.text}`)
    pass()

    step("tasks query contains the created task")
    const listed = await graphql(LIST_TASKS, {}, token1)
    assertSuccess(listed)
    assert(listed.text.includes(taskId), `created task not in list: ${listed.text}`)
    pass()

    // br.task.complete.once: completing twice is idempotent
    step("completeTask (first time) -> complete:true")
    const firstComplete = await graphql(COMPLETE_TASK, { id: taskId }, token1)
    assertSuccess(firstComplete)
    assert(firstComplete.field("completeTask", "complete") === "true", `complete:true not in body: ${firstComplete.text}`)
    pass()

    step("completeTask (again) -> identical body (br.task.complete.once)")
    const secondComplete = await graphql(COMPLETE_TASK, { id: taskId }, token1)
    assertSuccess(secondComplete)
    assert(secondComplete.text === firstComplete.text, `second complete body differs: '${secondComplete.text}' vs '${firstComplete.text}'`)
    pass()

    step("reopenTask -> complete:false")
    const reopened = await graphql(REOPEN_TASK, { id: taskId }, token1)
    assertSuccess(reopened)
    assert(reopened.field("reopenTask", "complete") === "false", `complete:false not in body: ${reopened.text}`)
    pass()

    // br.task.delete.final
    step("deleteTask -> deleted:true")
    const deleted = await graphql(DELETE_TASK, { id: taskId }, token1)
    assertSuccess(deleted)
    assert(deleted.field("deleteTask", "deleted") === "true", `deleted:true not in body: ${deleted.text}`)
    pass()

    step("tasks query no longer contains the deleted task (br.task.delete.final)")
    const afterDelete = await graphql(LIST_TASKS, {}, token1)
    assertSuccess(afterDelete)
    assert(!afterDelete.text.includes(taskId), `deleted task still listed: ${afterDelete.text}`)
    pass()

    // br.task.list.owned: a second identity's task never appears in the first identity's list
    step("signIn demo2 -> sessionToken")
    const token2 = await proof.signIn(demo2Email, demo2Password)
    pass()

    step("demo2 creates a task -> taskId")
    const created2 = await graphql(CREATE_TASK, { input: { title: "demo2 private task" } }, token2)
    assertSuccess(created2)
    const task2Id = created2.field("createTask", "taskId")
    assert(task2Id, `no taskId in response: ${created2.text}`)
    pass()

    step("demo1 list does not contain demo2's task (br.task.list.owned)")
    const demo1List = await graphql(LIST_TASKS, {}, token1)
    assertSuccess(demo1List)
    assert(!demo1List.text.includes(task2Id), `demo1 can see demo2's task: ${demo1List.text}`)
    pass()

    step("cleanup: demo2 deletes its own task")
    assertSuccess(await graphql(DELETE_TASK, { id: task2Id }, token2))
    pass()

    // CORS (transport-level): the GraphQL endpoint answers a preflight and a POST for the front end's origin
    step(`OPTIONS preflight from ${origin} carries Access-Control-Allow-Origin`)
    const preflight = await fetch(`${apiUrl}/graphql`, {
        method: "OPTIONS",
        headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" },
    })
    assert(preflight.headers.get("access-control-allow-origin") === origin, `no Access-Control-Allow-Origin header on OPTIONS: ${[...preflight.headers.keys()].join(",")}`)
    pass()

    step(`POST from ${origin} carries Access-Control-Allow-Origin`)
    const cors = await fetch(`${apiUrl}/graphql`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", authorization: `Bearer ${token1}` },
        body: JSON.stringify({ query: LIST_TASKS, variables: {} }),
    })
    assert(cors.headers.get("access-control-allow-origin") === origin, `no Access-Control-Allow-Origin header on POST: ${[...cors.headers.keys()].join(",")}`)
    pass()

    // sign-out revokes the session
    step("signOut demo1 -> signedOut:true")
    const signedOut = await graphql(SIGN_OUT, { input: { sessionToken: token1 } })
    assertSuccess(signedOut)
    assert(signedOut.field("signOut", "signedOut") === "true", `signedOut:true not in body: ${signedOut.text}`)
    pass()

    step("tasks query after sign-out -> SESSION_NOT_FOUND")
    assertRefused(await graphql(LIST_TASKS, {}, token1), "SESSION_NOT_FOUND")
    pass()

    // auth bypass regression: an absent Authorization header once reached findOneBy({ token: undefined }) and
    // silently matched an arbitrary session row. Only a live run against the real Postgres session table can
    // prove TypeORM's actual criteria-building behaviour, which the in-memory fake entity manager does not reproduce.
    step("tasks query with no Authorization header at all -> SESSION_NOT_FOUND, never another person's data")
    assertRefused(await graphql(LIST_TASKS), "SESSION_NOT_FOUND")
    pass()

    step("createTask with no Authorization header at all -> SESSION_NOT_FOUND, no row created")
    assertRefused(await graphql(CREATE_TASK, { input: { title: "should never be created" } }), "SESSION_NOT_FOUND")
    pass()

    step("tasks query with a malformed Authorization header (no Bearer prefix) -> SESSION_NOT_FOUND")
    assertRefused(await graphql(LIST_TASKS, {}, "", { authorization: "not-a-bearer-token" }), "SESSION_NOT_FOUND")
    pass()

    // health (the one surviving HTTP door)
    step("GET /health -> status:ok")
    const health = await (await fetch(`${apiUrl}/health`)).text()
    assert(health.includes("\"status\":\"ok\""), `health endpoint did not report ok: ${health}`)
    pass()

    proof.finish()
})
