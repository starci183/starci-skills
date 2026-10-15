// proves: FE_COOKIE_ATTRIBUTES@lite
// proves: FE_COOKIE_ATTRIBUTES@full
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { responseCookieAttributes } from "./client-boundary.mjs"

const ROUTE = at("apps/web/src/app/auth/callback/route.ts")
const imports = 'import { NextResponse } from "next/server"\nimport { cookies } from "next/headers"\n'
const sessionOptions = 'const OPTIONS = { httpOnly: true, secure: true, sameSite: "lax" } as const\n'

for (const edition of ["lite", "full"]) {
    test(`${edition} FE_COOKIE_ATTRIBUTES accepts explicit attributes and rejects incomplete cookie writes`, () => {
        const tester = typedTester({ lite: edition === "lite" })
        tester.run("response-cookie-attributes", responseCookieAttributes, {
            valid: [
                { filename: ROUTE, code: imports + sessionOptions + 'NextResponse.json({}).cookies.set("session", "value", OPTIONS)' },
                { filename: ROUTE, code: imports + sessionOptions + 'export const clear = async () => { (await cookies()).set("session", "", { ...OPTIONS, maxAge: 0 }) }' },
                { filename: ROUTE, code: imports + 'NextResponse.json({}).cookies.set({ name: "display", value: "compact", httpOnly: false, secure: true, sameSite: "strict" })' },
            ],
            invalid: [
                { filename: ROUTE, code: imports + 'NextResponse.json({}).cookies.set("session", "value")', errors: [{ messageId: "attributes" }] },
                { filename: ROUTE, code: imports + 'NextResponse.json({}).cookies.set("session", "value", { secure: true, sameSite: "lax" })', errors: [{ messageId: "attributes", data: { missing: "`httpOnly` stated as `true` or `false`" } }] },
                { filename: ROUTE, code: imports + 'NextResponse.json({}).cookies.set("session", "value", { httpOnly: true, sameSite: "strict", secure: false })', errors: [{ messageId: "attributes", data: { missing: "`secure`" } }] },
                { filename: ROUTE, code: imports + 'NextResponse.json({}).cookies.set("session", "value", { httpOnly: true, secure: true, sameSite: "none" })', errors: [{ messageId: "attributes", data: { missing: '`sameSite: "lax"` or `"strict"`' } }] },
                { filename: ROUTE, code: imports + 'export const write = async () => { (await cookies()).set({ name: "session", value: "value" }) }', errors: [{ messageId: "attributes" }] },
            ],
        })
    })
}
