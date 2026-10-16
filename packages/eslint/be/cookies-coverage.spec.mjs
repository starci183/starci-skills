// proves: BE_COOKIE_ATTRIBUTES@lite
// proves: BE_COOKIE_ATTRIBUTES@full
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { responseCookieAttributes } from "./cookies.mjs"

const FILE = at("src/features/session/transport/http/session.controller.ts")
const HEAD = 'import type { Response } from "express"\ndeclare const res: Response\n'

for (const edition of ["lite", "full"]) {
    test(`${edition} accepts protected cookies and rejects unsafe cookie writers`, () => {
        typedTester().run("response-cookie-attributes", responseCookieAttributes, {
            valid: [
                { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: true, sameSite: "lax" })` },
                { filename: FILE, code: `${HEAD}const options = { httpOnly: true, secure: true, sameSite: "strict" } as const\nres.cookie("sid", "v", { ...options, maxAge: 1000 })` },
                { filename: FILE, code: `${HEAD}res.clearCookie("sid")\nres.setHeader("Cache-Control", "no-store")` },
            ],
            invalid: [
                { filename: FILE, code: `${HEAD}res.cookie("sid", "v")`, errors: [{ messageId: "attributes" }] },
                { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: false, secure: true, sameSite: "lax" })`, errors: [{ messageId: "attributes" }] },
                { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: false, sameSite: "lax" })`, errors: [{ messageId: "attributes" }] },
                { filename: FILE, code: `${HEAD}res.cookie("sid", "v", { httpOnly: true, secure: true, sameSite: "none" })`, errors: [{ messageId: "attributes" }] },
                { filename: FILE, code: `${HEAD}res.setHeader("Set-Cookie", "sid=v")`, errors: [{ messageId: "raw" }] },
            ],
        })
    })
}
