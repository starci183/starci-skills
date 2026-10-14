// proves: FE_CALLBACK_SHAPE@lite FE_CALLBACK_SHAPE@full
/** R287: callbacks are PKCE exchanges and redirects in both editions, with lexical provenance for the allowed calls. */
import assert from "node:assert/strict"
import test from "node:test"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { appDeclaration } from "../be/fixtures/app.mjs"
import { at, TYPED_ROOT } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { callbackShape, recommended, rules } from "./callback-shape.mjs"

const CALLBACK = at("apps/web/src/app/auth/callback/route.ts")
const IMPORTS = 'import { NextResponse, type NextRequest } from "next/server"\nimport { createClient } from "@/modules/auth/server"'
const BODY = 'const code = request.nextUrl.searchParams.get("code"); if (code) { const supabase = await createClient(); await supabase.auth.exchangeCodeForSession(code) } return NextResponse.redirect(new URL("/", request.url))'
const callback = (body = BODY, imports = IMPORTS) => `${imports}\nexport async function GET(request: NextRequest) { ${body} }`
const invalid = (code) => ({ filename: CALLBACK, code, errors: [{ messageId: "shape" }] })

/** A Supabase-connected application makes the provider callback slot available in either edition. */
const testerFor = (edition) => {
  const declaration = appDeclaration("fe", { apps: [{ name: "web", kind: "next" }] })
  declaration.edition = edition
  declaration.sides.be.connections = [{ name: "primary", envPrefix: "PRIMARY_DB", owner: "core", isolation: "schema", provider: "supabase" }]
  return new RuleTester({
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
    settings: { starci: { hfs: hfsFromDeclaration(declaration, TYPED_ROOT) } },
  })
}

test("R287 registers one error rule", () => {
  assert.equal(rules["callback-shape"], callbackShape)
  assert.deepEqual(recommended, { "starci-fe/callback-shape": "error" })
})

for (const edition of ["lite", "full"]) {
  test(`R287 ${edition}: natural OAuth callback shapes pass, extra work and lookalikes fail`, () => {
    testerFor(edition).run("callback-shape", callbackShape, {
      valid: [
        { filename: CALLBACK, code: callback() },
        { filename: CALLBACK, code: callback(BODY.replace('new URL("/", request.url))', 'new URL("/", request.url), { status: 303 })')) },
        { filename: CALLBACK, code: callback(BODY.replace('new URL("/", request.url)', 'new URL(`${request.nextUrl.origin}/`, request.url)')) },
        // Request.url and destructured URL parts are the equivalent query source.
        { filename: CALLBACK, code: callback('const { searchParams, origin } = new URL(request.url); const code = searchParams.get("code"); const next = searchParams.get("next") ?? "/"; if (code) { const client = await createClient(request); const { error } = await client.auth.exchangeCodeForSession(code); if (error) return NextResponse.redirect(new URL("/login", origin)) } return NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/", origin))') },
        // Import aliases, local aliases and static bracket access retain the actual owners.
        { filename: CALLBACK, code: callback('const params = request.nextUrl.searchParams; const code = params["get"]("code"); const makeClient = make; if (code) { const client = await makeClient(); const auth = client.auth; await auth["exchangeCodeForSession"](code) } const go = Reply.redirect; return go(new URL("/", request.url))', 'import { NextResponse as Reply, type NextRequest } from "next/server"\nimport { createServerClient as make } from "../../../modules/auth/server"') },
        // next/navigation redirect is also a redirect, including the never-returning form.
        { filename: CALLBACK, code: callback('const code = request.nextUrl.searchParams.get("code"); if (code) { const client = await createClient(); await client.auth.exchangeCodeForSession(code) } redirect("/")', 'import type { NextRequest } from "next/server"\nimport { redirect } from "next/navigation"\nimport { createClient } from "@/modules/auth/server"') },
        // The same single GET may be an arrow exported through a local export list.
        { filename: CALLBACK, code: `${IMPORTS}\nconst GET = async (request: NextRequest) => { ${BODY} }; export { GET }; export const runtime = "nodejs"` },
        // This rule judges only the callback slot.
        { filename: at("apps/web/src/modules/auth/server.ts"), code: 'export const writeCookies = () => cookies().set("session", "value")' },
        { filename: at("apps/web/src/app/health/live/route.ts"), code: 'export async function GET() { return Response.json({ alive: true }) }' },
      ],
      invalid: [
        invalid(callback(BODY.replace("return NextResponse", 'await fetch("/api/profile"); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const send = fetch; await send("/api/profile"); return NextResponse'))),
        invalid(callback(BODY.replace("await supabase.auth.exchangeCodeForSession(code)", 'await supabase.auth.exchangeCodeForSession(code); await supabase.from("profiles").select("*")'))),
        invalid(callback(BODY.replace("return NextResponse", 'const response = NextResponse.redirect(new URL("/", request.url)); response.cookies.set("session", "value"); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'request.cookies.set("session", "value"); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const { headers } = request; headers.set("x-app", "value"); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'console.log(code); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'await import("@/modules/api/graphql/queries/query-profile"); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const extra = () => fetch("/data"); extra(); return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse.redirect(new URL(\"/\", request.url))", "return NextResponse.json({ ok: true })"))),
        invalid(callback(BODY.replace("await supabase.auth.exchangeCodeForSession(code)", "supabase.auth.exchangeCodeForSession(code)"))),
        invalid(callback(BODY.replace('searchParams.get("code")', 'searchParams.get("userId")'))),
        invalid(callback('return NextResponse.redirect(new URL("/", request.url))')),
        invalid(callback(`${BODY}; await createClient()`)),
        invalid(`${callback()}\nexport async function POST(request: NextRequest) { return NextResponse.redirect(new URL("/", request.url)) }`),
        invalid(callback(BODY, IMPORTS.replace("@/modules/auth/server", "@/modules/api/graphql/clients/client"))),
        invalid(callback(BODY, `${IMPORTS}\nimport { readProfile } from "@/modules/api/graphql/queries/query-profile"`)),
        // A locally declared auth lookalike and a shadowed redirect owner cannot widen the allowed calls.
        invalid(callback(BODY.replace("const supabase = await createClient()", 'const supabase = { auth: { exchangeCodeForSession: fetch } }'))),
        invalid(callback(BODY.replace("return NextResponse", 'const NextResponse = { redirect: fetch }; return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const URL = fetch; return NextResponse'))),
        invalid(callback(BODY.replace("await supabase.auth.exchangeCodeForSession(code)", 'const method = request.nextUrl.searchParams.get("method"); await supabase.auth[method](code)'))),
        invalid(callback(BODY.replace("await supabase.auth.exchangeCodeForSession(code)", 'await supabase.auth.exchangeCodeForSession(code); await supabase.auth.exchangeCodeForSession(code)'))),
        invalid(callback().replace("async function GET", "async function* GET")),
        invalid(callback(BODY.replace("return NextResponse", 'const [profile] = request; return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const snapshot = { ...request }; return NextResponse'))),
        invalid(callback(BODY.replace("return NextResponse", 'const snapshot = [...request]; return NextResponse'))),
        invalid(callback(BODY.replace('new URL("/", request.url)', 'new URL(`${{ toString: createClient }}`, request.url)'))),
        invalid(callback(BODY.replace('new URL("/", request.url))', 'new URL("/", request.url), { headers: request.nextUrl.searchParams })'))),
      ],
    })
  })
}
