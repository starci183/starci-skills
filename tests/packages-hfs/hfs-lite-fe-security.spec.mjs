import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"
import { render } from "../../packages/hfs/sync/index.mjs"

// Owner ruling 2026-10-13: Supabase on the front end is auth only. The lite skeleton's identity-provider client
// (modules/auth/client.ts, slot fe.modules.auth) is run against a recording Supabase double: every authClient call touches the
// client's `auth` API and nothing else (no from, rpc, storage, channel), and the PKCE flow runs in the browser.
const ROOT = path.resolve(import.meta.dirname, "..", "..")
const AUTH_CLIENT = path.join(ROOT, "packages", "hfs", "templates", "fe", "skeleton-lite", "apps", "__app__", "src", "modules", "auth", "client.ts")
const ts = createRequire(import.meta.url)("typescript")

/** The template's exports, run with a recording @supabase/supabase-js double; `touched` lists the client members it reached. */
function loadAuthClient() {
    const touched = []
    const options = []
    const result = (data) => Promise.resolve({ data, error: null })
    const auth = {
        getSession: () => result({ session: { access_token: "token", user: { id: "u1", email: "a@example.com" } } }),
        refreshSession: () => result({ session: { access_token: "fresh", user: { id: "u1" } } }),
        signInWithPassword: () => result({}),
        signOut: () => result({}),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    }
    const client = new Proxy({ auth }, { get: (target, name) => { touched.push(String(name)); return target[name] } })
    const modules = {
        "@supabase/supabase-js": { createClient: (url, key, settings) => { options.push(settings); return client } },
        "@/modules/config": { supabaseUrl: () => "https://fixture.invalid", supabaseAnonKey: () => "public-anon" },
    }
    const compiled = ts.transpileModule(render(fs.readFileSync(AUTH_CLIENT, "utf8").replace(/\r\n/g, "\n"), {}), {
        fileName: "client.ts",
        reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    assert.deepEqual(compiled.diagnostics, [], "modules/auth/client.ts has valid TypeScript syntax")
    const module = { exports: {} }
    const require = (name) => {
        if (!(name in modules)) throw new Error(`modules/auth/client.ts imports ${name}, which the auth owner does not need`)
        return modules[name]
    }
    vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require }, { filename: "client.ts" })
    return { authClient: module.exports.authClient, touched, options }
}

test("the lite auth client reaches only the Supabase auth API, never data, rpc, storage or realtime", async () => {
    const { authClient, touched, options } = loadAuthClient()
    // the client runs in its own vm realm: its objects are compared by their own enumerable properties
    assert.deepEqual({ ...(await authClient.session()) }, { userId: "u1", email: "a@example.com" })
    assert.equal(await authClient.accessToken(), "token")
    assert.equal(await authClient.refreshAccessToken(), "fresh")
    assert.equal(await authClient.signInWithPassword("a@example.com", "password"), undefined, "a sign-in that succeeded has no failure")
    assert.equal(await authClient.signOut(), undefined)
    const stop = authClient.onChange(() => undefined)
    stop()
    assert.ok(touched.length > 0, "the client was used")
    assert.deepEqual([...new Set(touched)], ["auth"], `members touched: ${touched.join(", ")}`)
    assert.equal(options.length, 1, "one Supabase client per browser")
    assert.equal(options[0].auth.flowType, "pkce", "the PKCE code exchange runs in the browser: no route handler")
})
