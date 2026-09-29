// Shared helpers for the live-proof-*.mjs scripts: each script drives the running api over its one GraphQL
// endpoint against the real dev stack (never fakes) and exits non-zero on the first mismatch, naming the step.
// The outcome of an operation lives in the JSON body (`errors[]` present vs `data.<op>` present), never in the
// HTTP status code: Apollo answers 200 for a resolver-thrown business refusal exactly as it does for a success.

export const SIGN_IN = "mutation SignIn($input: SignInInput!) { signIn(request: $input) { sessionToken personId } }"
export const SIGN_OUT = "mutation SignOut($input: SignOutInput!) { signOut(request: $input) { signedOut } }"
export const CREATE_TASK = "mutation CreateTask($input: CreateTaskInput!) { createTask(request: $input) { taskId title } }"
export const LIST_TASKS = "query { tasks { taskId title complete } }"
export const COMPLETE_TASK = "mutation CompleteTask($id: ID!) { completeTask(request: {id: $id}) { taskId complete } }"
export const REOPEN_TASK = "mutation ReopenTask($id: ID!) { reopenTask(request: {id: $id}) { taskId complete } }"
export const DELETE_TASK = "mutation DeleteTask($id: ID!) { deleteTask(request: {id: $id}) { deleted } }"

/** Reads a value out of the environment with a default; the demo identities mirror the DEMO-ONLY realm users. */
export const env = (name, fallback) => process.env[name] ?? fallback

/** One proof run: numbered steps, a failing step exits 1 with its name, and `finish` prints the tally. */
export function createProof(name, apiUrl) {
    let current = ""
    let passed = 0

    const fail = (message) => {
        process.stderr.write(`FAIL [${current}]: ${message}\n`)
        process.exit(1)
    }

    /** Runs one GraphQL operation; `token` becomes the Bearer header. Returns the parsed outcome. */
    const graphql = async (document, variables = {}, token = "", extraHeaders = {}) => {
        const headers = { "content-type": "application/json", ...extraHeaders }
        if (token) headers.authorization = `Bearer ${token}`
        const response = await fetch(`${apiUrl}/graphql`, { method: "POST", headers, body: JSON.stringify({ query: document, variables }) })
        const text = await response.text()
        let parsed
        try {
            parsed = JSON.parse(text)
        } catch {
            fail(`the api answered non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`)
        }
        const hasErrors = Array.isArray(parsed.errors) && parsed.errors.length > 0
        return {
            text,
            body: parsed,
            hasErrors,
            errorCode: parsed.errors?.[0]?.extensions?.code ?? "",
            errorMessage: parsed.errors?.[0]?.message ?? "",
            field: (operation, key) => {
                const value = parsed.data?.[operation]?.[key]
                return value === undefined || value === null ? "" : String(value)
            },
        }
    }

    const assertSuccess = (result) => {
        if (result.hasErrors) fail(`expected success, got errors: ${result.text}`)
    }

    return {
        apiUrl,
        fail,
        graphql,
        assertSuccess,
        step(title) {
            current = title
            process.stdout.write(`-- ${title}\n`)
        },
        pass() {
            passed += 1
            process.stdout.write("   ok\n")
        },
        assertRefused(result, code) {
            if (!result.hasErrors) fail(`expected a refusal (code ${code}), got success: ${result.text}`)
            if (result.errorCode !== code) fail(`expected error code ${code}, got ${result.errorCode}: ${result.text}`)
        },
        assert(condition, message) {
            if (!condition) fail(message)
        },
        /** Signs in and returns the session token. */
        async signIn(email, password) {
            const result = await graphql(SIGN_IN, { input: { email, password } })
            assertSuccess(result)
            const token = result.field("signIn", "sessionToken")
            if (!token) fail(`no sessionToken in response: ${result.text}`)
            return token
        },
        finish(note = "steps passed") {
            process.stdout.write(`\n${name}: ${passed}/${passed} ${note}\n`)
        },
    }
}

/** Runs a proof body; an unexpected throw fails the run instead of leaving a silent exit code. */
export async function run(main) {
    try {
        await main()
    } catch (error) {
        process.stderr.write(`FAIL: ${error instanceof Error ? error.stack : String(error)}\n`)
        process.exit(1)
    }
}
