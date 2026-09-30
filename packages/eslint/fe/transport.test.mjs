/**
 * Twin tests for the transport rules (HFS R50, R51, R52).
 *
 *   node --test transport.test.mjs
 *
 * The cases that earn their place are the collapse shapes: `null`, an empty array and a bare throw
 * all say "something failed" and nothing else, and each looks like defensive code when read alone.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  clientFetchHasSignal,
  clientMapsAuthToRefused,
  fetchOnlyInApiClient,
  noHandTypedWire,
  noHttpStatusCollapse,
  noSharedTransportState,
  outcomeKindsExhaustive,
  rules,
} from "./transport.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})

const CLIENT = "D:/repo/src/modules/api/client.ts"
const READER = "D:/repo/src/modules/api/course/read-course.ts"
const CONTRACT = "D:/repo/src/modules/api/contract/types.ts"
const HOOK = "D:/repo/src/hooks/course/useCourse.ts"
const SPEC = "D:/repo/src/modules/api/client.test.ts"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-TRANSPORT-1: fetch is called in the client and nowhere else", () => {
  tester.run("fetch-only-in-api-client", fetchOnlyInApiClient, {
    valid: [
      { filename: CLIENT, code: "const r = await fetch(url, { signal })" },
      { filename: HOOK, code: "const r = await client.get(url)" },
      { filename: SPEC, code: "const r = await fetch(url)" },
      // a property that merely has the name is not the global
      { filename: HOOK, code: "const r = await api.fetch(url)" },
    ],
    invalid: [
      { filename: HOOK, code: "const r = await fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await globalThis.fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await window.fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: HOOK, code: "import axios from \"axios\"", errors: [{ messageId: "library" }] },
      { filename: CLIENT, code: "import ky from \"ky\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "const x = new XMLHttpRequest()", errors: [{ messageId: "xhr" }] },
    ],
  })
})

test("FE-TRANSPORT-2: the client's fetch carries an abort signal", () => {
  tester.run("client-fetch-has-signal", clientFetchHasSignal, {
    valid: [
      { filename: CLIENT, code: "fetch(url, { method: \"GET\", signal: AbortSignal.timeout(8000) })" },
      { filename: CLIENT, code: "fetch(url, { ...init })" },
      { filename: CLIENT, code: "fetch(url, init)" },
      { filename: READER, code: "fetch(url)" },
    ],
    invalid: [
      { filename: CLIENT, code: "fetch(url)", errors: [{ messageId: "signal" }] },
      { filename: CLIENT, code: "fetch(url, { method: \"POST\" })", errors: [{ messageId: "signal" }] },
    ],
  })
})

test("FE-TRANSPORT-3: no module-level mutable state in the API layer", () => {
  tester.run("no-shared-transport-state", noSharedTransportState, {
    valid: [
      { filename: CLIENT, code: "const TIMEOUT = 8000\nexport const t = TIMEOUT" },
      { filename: CLIENT, code: "export const f = () => { let n = 0; return n }" },
      { filename: HOOK, code: "let token = null" },
      { filename: CONTRACT, code: "let x = 1" },
    ],
    invalid: [
      { filename: CLIENT, code: "let token = null", errors: [{ messageId: "shared" }] },
      { filename: READER, code: "export let locale = \"vi\"", errors: [{ messageId: "shared" }] },
      { filename: CLIENT, code: "var cache = {}", errors: [{ messageId: "shared" }] },
    ],
  })
})

test("FE-TRANSPORT-4: the client maps 401 and 403 to refused", () => {
  tester.run("client-maps-auth-to-refused", clientMapsAuthToRefused, {
    valid: [
      {
        filename: CLIENT,
        code: "const r = await fetch(u, { signal })\nif (r.status === 401 || r.status === 403) return { kind: \"refused\" }",
      },
      // a module with no fetch owes no mapping
      { filename: CLIENT, code: "export const x = 1" },
      { filename: HOOK, code: "fetch(u)" },
    ],
    invalid: [
      { filename: CLIENT, code: "const r = await fetch(u, { signal })", errors: [{ messageId: "refused" }] },
      {
        filename: CLIENT,
        code: "const r = await fetch(u, { signal })\nif (r.status === 401) return { kind: \"refused\" }",
        errors: [{ messageId: "refused" }],
      },
    ],
  })
})

test("FE-STATUS-1: a failed response is not one branch and not null", () => {
  tester.run("no-http-status-collapse", noHttpStatusCollapse, {
    valid: [
      { filename: CLIENT, code: "if (!res.ok) return toOutcome(res)" },
      { filename: CLIENT, code: "if (!res.ok) { return { kind: mapStatus(res.status) } }" },
      { filename: CLIENT, code: "if (res.status === 401) return { kind: \"refused\" }" },
      { filename: CLIENT, code: "if (!res.ok) throw new HttpError(res.status)" },
      { filename: CLIENT, code: "const x = res.ok ? await res.json() : toOutcome(res)" },
      // an unrelated null return is not a status collapse
      { filename: HOOK, code: "if (!user) return null" },
      { filename: SPEC, code: "if (!res.ok) return null" },
    ],
    invalid: [
      { filename: CLIENT, code: "if (!res.ok) return null", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (!response.ok) { return undefined }", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (!res.ok) { return [] }", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (res.ok === false) return", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (res.status !== 200) return null", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (res.status === 404) return null", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "const x = res.ok ? await res.json() : null", errors: [{ messageId: "empty" }] },
      { filename: CLIENT, code: "if (!res.ok) throw new Error(\"failed\")", errors: [{ messageId: "collapse" }] },
      { filename: CLIENT, code: "if (!res.ok) return { kind: \"unavailable\" }", errors: [{ messageId: "collapse" }] },
      { filename: CLIENT, code: "const o = { reason: res.statusText }", errors: [{ messageId: "raw" }] },
      { filename: CLIENT, code: "const o = { message: await res.text() }", errors: [{ messageId: "raw" }] },
    ],
  })
})

test("FE-WIRE-1: a response body is narrowed from unknown or typed by a generated type, never by a hand-written one", () => {
  tester.run("no-hand-typed-wire", noHandTypedWire, {
    valid: [
      { filename: READER, code: "import type { CourseQuery } from \"../__generated__/graphql\"\nconst x: CourseQuery = y" },
      { filename: READER, code: "const q = loadDocument(\"course.graphql\")" },
      // hand-declared shapes are not the rule's business: only a value read from a response and typed by hand is
      { filename: CONTRACT, code: "export interface CourseResponse { id: string }" },
      { filename: HOOK, code: "export interface CourseResponse { id: string }" },
      { filename: READER, code: "export interface CourseResponse { id: string }" },
      { filename: CLIENT, code: "export type LoginPayload = { email: string }" },
      { filename: READER, code: "const n = value as number" },
      { filename: READER, code: "const label = \"select the query text\"" },
      { filename: SPEC, code: "const x = (await res.json()) as Course" },
      // live (starci-next-fe): `as unknown` is the sanctioned narrowing entry
      { filename: READER, code: "const body = (await response.json()) as unknown" },
      { filename: READER, code: "const body: unknown = await response.json()" },
      { filename: READER, code: "const body = await res.json()\nconst safe = body as unknown" },
      // a type imported from the generated wire module is not hand-typed
      { filename: READER, code: "import type { CourseQuery } from \"../__generated__/graphql\"\nconst x = (await res.json()) as CourseQuery" },
      { filename: READER, code: "import type { CourseQuery } from \"../__generated__/graphql\"\nconst x: CourseQuery = await res.json()" },
      { filename: READER, code: "import type * as Wire from \"../__generated__/graphql\"\nconst x = (await res.json()) as Wire.CourseQuery" },
      { filename: READER, code: "const x = (await res.json()) as const" },
      // a cast of something that is not a response read is `no-type-assertion`'s business
      { filename: READER, code: "const x = y as GraphqlResult<Course>" },
      { filename: READER, code: "const body = JSON.parse(text)\nconst x = body as Course" },
    ],
    invalid: [
      { filename: READER, code: "const x = (await res.json()) as Course", errors: [{ messageId: "cast" }] },
      { filename: READER, code: "const x = <Course>await res.json()", errors: [{ messageId: "cast" }] },
      { filename: READER, code: "const x = (await response.json()) as Record<string, string>", errors: [{ messageId: "cast" }] },
      { filename: READER, code: "const x: Course = await res.json()", errors: [{ messageId: "cast" }] },
      { filename: READER, code: "const body = await res.json()\nconst x = body as Course", errors: [{ messageId: "cast" }] },
      // a type of the same name imported from anywhere but the generated module is a hand-typed wire
      { filename: READER, code: "import type { Course } from \"./types\"\nconst x = (await res.json()) as Course", errors: [{ messageId: "cast" }] },
      { filename: READER, code: "const q = gql`query Course { course { id } }`", errors: [{ messageId: "document" }] },
      { filename: READER, code: "const q = `query Course { course { id } }`", errors: [{ messageId: "document" }] },
      { filename: READER, code: "const q = \"mutation Save { save { id } }\"", errors: [{ messageId: "document" }] },
    ],
  })
})

test("TRANSPORT-7: a switch over an Outcome names every kind", () => {
  tester.run("outcome-kinds-exhaustive", outcomeKindsExhaustive, {
    valid: [
      {
        filename: HOOK,
        code: "switch (outcome.kind) { case 'ok': return a; case 'refused': return b; case 'invalid': return c; case 'not-found': return d; case 'unavailable': return e }",
      },
      // a switch over some other discriminant is not an Outcome
      { filename: HOOK, code: "switch (shape.kind) { case 'circle': return 1; case 'square': return 2 }" },
      { filename: HOOK, code: "switch (state) { case 'ok': return 1 }" },
      {
        filename: "D:/repo/src/hooks/course/useCourse.test.ts",
        code: "switch (outcome.kind) { case 'ok': return a }",
      },
    ],
    invalid: [
      {
        filename: HOOK,
        code: "switch (outcome.kind) { case 'ok': return a; default: return b }",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: HOOK,
        code: "switch (outcome.kind) { case 'ok': return a; case 'unavailable': return e }",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: HOOK,
        code: "switch (result.outcome.kind) { case 'ok': return a; case 'refused': return b; case 'invalid': return c; case 'not-found': return d }",
        errors: [{ messageId: "missing" }],
      },
    ],
  })
})
