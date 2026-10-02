/**
 * Tests for `response-cookie-attributes` (R141 BE_COOKIE_ATTRIBUTES).
 *
 *   node --test cookies.spec.mjs
 */
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { responseCookieAttributes } from "./cookies.mjs"

const FILE = at("src/features/session/transport/http/session.controller.ts")
const HEAD = 'import type { Response } from "express"\ndeclare const res: Response\n'
const OPTIONS = 'const SESSION_COOKIE = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const\n'

test("a cookie a door writes states httpOnly, secure and sameSite, judged on the type of its options", () => {
    typedTester().run("response-cookie-attributes", responseCookieAttributes, {
        valid: [
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: true, sameSite: "strict" })` },
            // an options constant keeps its literals through the spread
            { filename: FILE, code: `${HEAD}${OPTIONS}res.cookie("sid", "v", SESSION_COOKIE)` },
            { filename: FILE, code: `${HEAD}${OPTIONS}res.cookie("sid", "v", { ...SESSION_COOKIE, maxAge: 1000 })` },
            // clearing a cookie, and headers other than Set-Cookie, say nothing about a written cookie
            { filename: FILE, code: `${HEAD}res.clearCookie("sid")\nres.setHeader("Cache-Control", "no-store")` },
            // not a response of the express family: the receiver's name decides nothing
            { filename: FILE, code: 'declare const jar: { cookie(name: string, value: string): void }\njar.cookie("a", "b")' },
        ],
        invalid: [
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v")`, errors: [{ messageId: "attributes" }] },
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v", {})`, errors: [{ messageId: "attributes" }] },
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: false, secure: true, sameSite: "lax" })`, errors: [{ messageId: "attributes" }] },
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: false, sameSite: "lax" })`, errors: [{ messageId: "attributes" }] },
            { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: true, sameSite: "none" })`, errors: [{ messageId: "attributes" }] },
            // a bare boolean decides nothing; a name-only receiver called something else is still the express response
            { filename: FILE, code: `${HEAD}declare const flag: boolean\nconst out = res\nout.cookie("sid", "v", { httpOnly: flag, secure: true, sameSite: "lax" })`, errors: [{ messageId: "attributes" }] },
            // a hand-written Set-Cookie header states none of the three
            { filename: FILE, code: `${HEAD}res.setHeader("Set-Cookie", "sid=v")`, errors: [{ messageId: "raw" }] },
            { filename: FILE, code: `${HEAD}res.append("set-cookie", "sid=v")`, errors: [{ messageId: "raw" }] },
        ],
    })
})
