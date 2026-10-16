// proves: FE_HTTP_STATUS_COLLAPSE@lite
// proves: FE_HTTP_STATUS_COLLAPSE@full
// proves: FE_OUTCOME_KIND_UNHANDLED@lite
// proves: FE_OUTCOME_KIND_UNHANDLED@full
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { clientMapsAuthToRefused, noFailureCollapse, oneOutcomeUnion, outcomeKindsExhaustive } from "./transport.mjs"
import { at, fixtureHfs, LITE_FE_DECLARATION, typedTester } from "./fixtures/typed/tester.mjs"

const CLIENT = at("apps/web/src/modules/api/graphql/clients/links/http.ts")
const OUTCOME = at("apps/web/src/modules/api/graphql/types.ts")
const HOOK = at("apps/web/src/hooks/course/useCourse.ts")
const RESULT = 'export type Result<T> = { success: true; data: T } | { success: false; error: string }'

for (const edition of ["lite", "full"]) {
  test(`R51 ${edition} accepts auth status mapping and rejects missing refused branches`, () => {
    const tester = typedTester({ declaration: edition === "lite" ? LITE_FE_DECLARATION : undefined, lite: edition === "lite" })
    tester.run("client-maps-auth-to-refused", clientMapsAuthToRefused, {
      valid: [{
        filename: CLIENT,
        code: 'export const get = async (url: string) => { const response = await fetch(url); if (response.status === 401 || response.status === 403) return { ok: false, kind: "refused" }; return { ok: true } }',
      }],
      invalid: [{
        filename: CLIENT,
        code: 'export const get = async (url: string) => { const response = await fetch(url); if (response.status === 401) return { ok: false, kind: "refused" }; return { ok: true } }',
        errors: [{ messageId: "refused" }],
      }],
    })
  })

  test(`R51 ${edition} accepts the outcome home and rejects a second result union`, () => {
    const tester = typedTester({ declaration: edition === "lite" ? LITE_FE_DECLARATION : undefined, lite: edition === "lite" })
    tester.run("one-outcome-union", oneOutcomeUnion, {
      valid: [{ filename: OUTCOME, code: RESULT }],
      invalid: [{ filename: HOOK, code: RESULT, errors: [{ messageId: "second" }] }],
    })
  })

  test(`R51 ${edition} accepts preserved reasons and rejects collapsed failures or missing outcome kinds`, () => {
    const hfs = fixtureHfs(edition === "lite" ? LITE_FE_DECLARATION : undefined, { lite: edition === "lite" })
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
      settings: { starci: { hfs } },
    })
    tester.run("no-failure-collapse", noFailureCollapse, {
      valid: [{ filename: HOOK, code: "if (!result.ok) return messageFor(result.reason)" }],
      invalid: [{ filename: HOOK, code: "if (!result.ok) return null", errors: [{ messageId: "empty" }] }],
    })
    tester.run("outcome-kinds-exhaustive", outcomeKindsExhaustive, {
      valid: [{
        filename: HOOK,
        code: "switch (outcome.kind) { case 'ok': return a; case 'refused': return b; case 'invalid': return c; case 'not-found': return d; case 'unavailable': return e }",
      }],
      invalid: [{
        filename: HOOK,
        code: "switch (outcome.kind) { case 'ok': return a; default: return b }",
        errors: [{ messageId: "missing" }],
      }],
    })
  })
}
