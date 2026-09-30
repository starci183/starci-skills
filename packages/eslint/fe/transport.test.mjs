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
  oneOutcomeUnion,
  outcomeKindsExhaustive,
  rules,
} from "./transport.mjs"
import { at, slotTester, typedTester } from "./fixtures/typed/tester.mjs"

// Rules that read the slot of the file (fetch-only-in-api-client, ...) run under the fixture repository: two apps and the
// shared packages, so `at("apps/web/...")` is an app file and `at("packages/nivo-api/...")` the shared api package.
const slots = slotTester()
const typed = typedTester()

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})

const CLIENT = at("apps/web/src/modules/api/client.ts")
const PKG_CLIENT = at("packages/nivo-api/src/client.ts")
const PKG_TRANSPORT = at("packages/nivo-api/src/transport.ts")
const READER = at("apps/web/src/modules/api/course/read-course.ts")
const CONTRACT = at("apps/web/src/modules/api/contract/types.ts")
const HOOK = at("apps/web/src/hooks/course/useCourse.ts")

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-TRANSPORT-1: fetch is reached in the api client slot and nowhere else", () => {
  slots.run("fetch-only-in-api-client", fetchOnlyInApiClient, {
    valid: [
      { filename: CLIENT, code: "const r = await fetch(url, { signal })" },
      // a shared client in the api package is the legitimate shape of a multi-app repository
      { filename: PKG_CLIENT, code: "const r = await fetch(url, { signal })" },
      { filename: PKG_CLIENT, code: "const r = await globalThis.fetch(url, { signal })" },
      // the client may build a Request or beacon: it owns every request
      { filename: CLIENT, code: "const r = new Request(url, { signal })\nnavigator.sendBeacon(url, body)" },
      { filename: HOOK, code: "const r = await client.get(url)" },
      // a property that merely has the name is not the global
      { filename: HOOK, code: "const r = await api.fetch(url)" },
      // a binding of the file's own is not the global
      { filename: HOOK, code: "import { fetch } from \"./client\"\nconst r = await fetch(url)" },
      { filename: HOOK, code: "const fetch = makeFetch()\nconst r = await fetch(url)" },
      { filename: HOOK, code: "const load = (fetch) => fetch(url)" },
      { filename: HOOK, code: "const { fetch } = client" },
      // a type is not a connection
      { filename: HOOK, code: "type Init = Request\nconst f = (r: Request, t: typeof fetch) => r" },
      { filename: HOOK, code: "import type axios from \"axios\"" },
      { filename: HOOK, code: "const isRequest = (x: unknown) => x instanceof Request" },
      // a library named like a transport but not one
      { filename: HOOK, code: "import { z } from \"zod\"\nimport { got as gotIt } from \"./got\"" },
    ],
    invalid: [
      { filename: HOOK, code: "const r = await fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await globalThis.fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await window.fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await self.fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: READER, code: "const r = await globalThis[\"fetch\"](url)", errors: [{ messageId: "outside" }] },
      { filename: HOOK, code: "const f = fetch\nconst r = await f(url)", errors: [{ messageId: "outside" }] },
      { filename: HOOK, code: "const { fetch: f } = globalThis", errors: [{ messageId: "outside" }] },
      { filename: HOOK, code: "run(fetch)", errors: [{ messageId: "outside" }] },
      // any other file of the api package, and another app of the repository
      { filename: PKG_TRANSPORT, code: "const r = await fetch(url, { signal })", errors: [{ messageId: "outside" }] },
      { filename: at("apps/web/src/modules/api/transport.ts"), code: "const r = await fetch(url, { signal })", errors: [{ messageId: "outside" }] },
      { filename: at("apps/admin/src/hooks/course/useCourse.ts"), code: "const r = await fetch(url)", errors: [{ messageId: "outside" }] },
      { filename: at("packages/nivo-i18n/src/messages.ts"), code: "const r = await fetch(url)", errors: [{ messageId: "outside" }] },
      // a connection that is not `fetch` is a transport too
      { filename: HOOK, code: "const r = new Request(url)", errors: [{ messageId: "channel" }] },
      { filename: HOOK, code: "const s = new EventSource(url)", errors: [{ messageId: "channel" }] },
      { filename: HOOK, code: "navigator.sendBeacon(url, body)", errors: [{ messageId: "channel" }] },
      { filename: HOOK, code: "window.navigator.sendBeacon(url, body)", errors: [{ messageId: "channel" }] },
      { filename: HOOK, code: "const s = new globalThis.EventSource(url)", errors: [{ messageId: "channel" }] },
      { filename: HOOK, code: "const x = new XMLHttpRequest()", errors: [{ messageId: "xhr" }] },
      { filename: CLIENT, code: "const x = new XMLHttpRequest()", errors: [{ messageId: "xhr" }] },
      // a fetch library, resolved by its module specifier
      { filename: HOOK, code: "import axios from \"axios\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { ofetch } from \"ofetch\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import got from \"got\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { request } from \"undici\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { request } from \"graphql-request\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { useQuery } from \"urql\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { useQuery } from \"@apollo/client\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import { Client } from \"@urql/core\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "import ky from \"ky/distribution\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "export * from \"axios\"", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "const axios = await import(\"axios\")", errors: [{ messageId: "library" }] },
      { filename: HOOK, code: "const axios = require(\"axios\")", errors: [{ messageId: "library" }] },
      // even the client is built on fetch alone
      { filename: CLIENT, code: "import ky from \"ky\"", errors: [{ messageId: "library" }] },
      { filename: PKG_CLIENT, code: "import axios from \"axios\"", errors: [{ messageId: "library" }] },
    ],
  })
})

test("FE-TRANSPORT-2: the client's fetch carries an abort signal", () => {
  slots.run("client-fetch-has-signal", clientFetchHasSignal, {
    valid: [
      { filename: CLIENT, code: "fetch(url, { method: \"GET\", signal: AbortSignal.timeout(8000) })" },
      { filename: PKG_CLIENT, code: "fetch(url, { method: \"GET\", signal: AbortSignal.timeout(8000) })" },
      { filename: CLIENT, code: "globalThis.fetch(url, { signal })" },
      { filename: CLIENT, code: "fetch(url, { ...init })" },
      { filename: CLIENT, code: "fetch(url, init)" },
      // another file of the api layer is not the client; the transport rule judges it
      { filename: READER, code: "fetch(url)" },
      { filename: PKG_TRANSPORT, code: "fetch(url)" },
      { filename: HOOK, code: "fetch(url)" },
      // a binding of the file's own is not the global
      { filename: CLIENT, code: "import { fetch } from \"./transport\"\nfetch(url)" },
    ],
    invalid: [
      { filename: CLIENT, code: "fetch(url)", errors: [{ messageId: "signal" }] },
      { filename: CLIENT, code: "fetch(url, { method: \"POST\" })", errors: [{ messageId: "signal" }] },
      { filename: CLIENT, code: "globalThis.fetch(url, { method: \"POST\" })", errors: [{ messageId: "signal" }] },
      { filename: PKG_CLIENT, code: "fetch(url, { method: \"POST\" })", errors: [{ messageId: "signal" }] },
      { filename: PKG_CLIENT, code: "window.fetch(url)", errors: [{ messageId: "signal" }] },
    ],
  })
})

test("FE-TRANSPORT-3: no module-level mutable state in the API layer", () => {
  slots.run("no-shared-transport-state", noSharedTransportState, {
    valid: [
      { filename: CLIENT, code: "const TIMEOUT = 8000\nexport const t = TIMEOUT" },
      { filename: CLIENT, code: "export const f = () => { let n = 0; return n }" },
      { filename: PKG_CLIENT, code: "export const f = () => { let n = 0; return n }" },
      { filename: HOOK, code: "let token = null" },
      { filename: at("packages/nivo-ui/src/leaves/Menu/component.tsx"), code: "let count = 0" },
      { filename: CONTRACT, code: "let x = 1" },
      { filename: at("apps/web/src/modules/api/__generated__/graphql.ts"), code: "let x = 1" },
      // a folder named api below another module is not the API layer
      { filename: at("apps/web/src/modules/config/api/state.ts"), code: "let x = 1" },
    ],
    invalid: [
      // only the slot's own data folders (contract/, __generated__/) are data: one nested in a domain is code
      { filename: at("apps/web/src/modules/api/course/contract/read-state.ts"), code: "let x = 1", errors: [{ messageId: "shared" }] },
      { filename: CLIENT, code: "let token = null", errors: [{ messageId: "shared" }] },
      { filename: READER, code: "export let locale = \"vi\"", errors: [{ messageId: "shared" }] },
      { filename: CLIENT, code: "var cache = {}", errors: [{ messageId: "shared" }] },
      { filename: PKG_CLIENT, code: "let token = null", errors: [{ messageId: "shared" }] },
      { filename: PKG_TRANSPORT, code: "let token = null", errors: [{ messageId: "shared" }] },
      { filename: at("packages/nivo-api/src/outcome.ts"), code: "export let last = null", errors: [{ messageId: "shared" }] },
    ],
  })
})

const REFUSED_BRANCH = (test) => `export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (${test}) return { ok: false, kind: "refused" }\n  return { ok: true }\n}`

test("FE-TRANSPORT-4: the client maps a 401 and a 403 status to refused", () => {
  typed.run("client-maps-auth-to-refused", clientMapsAuthToRefused, {
    valid: [
      { filename: CLIENT, code: REFUSED_BRANCH("res.status === 401 || res.status === 403") },
      { filename: CLIENT, code: REFUSED_BRANCH("res.status == 403 || res.status == 401") },
      { filename: PKG_CLIENT, code: REFUSED_BRANCH("res.status === 401 || res.status === 403") },
      { filename: CLIENT, code: REFUSED_BRANCH("[401, 403].includes(res.status)") },
      { filename: CLIENT, code: "const AUTH = [401, 403] as const\n" + REFUSED_BRANCH("AUTH.includes(res.status)") },
      { filename: CLIENT, code: REFUSED_BRANCH("new Set([401, 403]).has(res.status)") },
      // two branches, one status each
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (res.status === 401) return { ok: false, kind: \"refused\" as const }\n  if (res.status === 403) return { ok: false, kind: \"refused\" as const }\n  return { ok: true }\n}",
      },
      // a switch with both cases
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  switch (res.status) {\n    case 401:\n    case 403:\n      return { ok: false, kind: \"refused\" }\n    default:\n      return { ok: true }\n  }\n}",
      },
      // a conditional expression, and a status read into a local
      { filename: CLIENT, code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  return res.status === 401 || res.status === 403 ? { ok: false, kind: \"refused\" } : { ok: true }\n}" },
      { filename: CLIENT, code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  const { status } = res\n  if (status === 401 || status === 403) return { ok: false, kind: \"refused\" }\n  return { ok: true }\n}" },
      { filename: CLIENT, code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  const code = res.status\n  if (code === 401 || code === 403) return { ok: false, kind: \"refused\" }\n  return { ok: true }\n}" },
      // the Outcome constructor named by its kind: starci-next-fe `failed("refused", { status, code })`
      { filename: CLIENT, code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (res.status === 401 || res.status === 403) return failed(\"refused\", { status: res.status })\n  return { ok: true }\n}" },
      // the branch sits in a helper whose parameter every call fills with the response status (starci-next-fe failureForResponse)
      { filename: CLIENT, code: "const failureFor = (status: number) => {\n  if (status === 401 || status === 403) return failed(\"refused\", { status })\n  return failed(\"unavailable\", { status })\n}\nexport const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (!res.ok) return failureFor(res.status)\n  return { ok: true }\n}" },
      // a module with no fetch owes no mapping, and a file that is not the client is not judged
      { filename: CLIENT, code: "export const x = 1" },
      { filename: HOOK, code: "fetch(u)" },
      { filename: PKG_TRANSPORT, code: "fetch(u)" },
    ],
    invalid: [
      { filename: CLIENT, code: "const r = await fetch(u, { signal })", errors: [{ messageId: "refused" }] },
      { filename: PKG_CLIENT, code: "const r = await fetch(u, { signal })", errors: [{ messageId: "refused" }] },
      // a helper whose parameter is never filled with the response status is not the status branch
      { filename: CLIENT, code: "const failureFor = (status: number) => {\n  if (status === 401 || status === 403) return failed(\"refused\", { status })\n  return failed(\"unavailable\", { status })\n}\nexport const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (!res.ok) return failureFor(500)\n  return { ok: true }\n}", errors: [{ messageId: "refused" }] },
      // the three literals lying in the file are not a branch
      { filename: CLIENT, code: "const r = await fetch(u, { signal })\nexport const AUTH = [401, 403]\nexport const KIND = \"refused\"", errors: [{ messageId: "refused" }] },
      { filename: CLIENT, code: REFUSED_BRANCH("res.status === 401"), errors: [{ messageId: "refused" }] },
      { filename: CLIENT, code: REFUSED_BRANCH("res.status === 403"), errors: [{ messageId: "refused" }] },
      // a status branch that leads somewhere else
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (res.status === 401 || res.status === 403) return { ok: false, kind: \"unavailable\" }\n  return { ok: true }\n}",
        errors: [{ messageId: "refused" }],
      },
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  if (res.status === 401) return { ok: false, kind: \"refused\" }\n  if (res.status === 403) return { ok: false, kind: \"forbidden\" }\n  return { ok: true }\n}",
        errors: [{ messageId: "refused" }],
      },
      // the comparison is not of the response's status
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  const job = { status: 401 }\n  if (job.status === 401 || job.status === 403) return { ok: false, kind: \"refused\" }\n  return res\n}",
        errors: [{ messageId: "refused" }],
      },
      // a switch that gives the two cases different outcomes
      {
        filename: CLIENT,
        code: "export const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  switch (res.status) {\n    case 401:\n      return { ok: false, kind: \"refused\" }\n    case 403:\n      return { ok: false, kind: \"invalid\" }\n    default:\n      return { ok: true }\n  }\n}",
        errors: [{ messageId: "refused" }],
      },
      // a mapping delegated to another file is invisible here
      {
        filename: CLIENT,
        code: "import { failureKindOfStatus } from \"./outcome\"\nexport const get = async (u: string) => {\n  const res = await fetch(u, { signal })\n  return { ok: false, kind: failureKindOfStatus(res.status) }\n}",
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

test("FE-OUTCOME-1: a result union is declared once, in the outcome slot", () => {
  const API_OUTCOME = at("apps/web/src/modules/api/outcome.ts")
  const PKG_OUTCOME = at("packages/nivo-api/src/outcome.ts")
  const UNION = "export type Outcome<T> = { ok: true; data: T } | { ok: false; kind: \"refused\" | \"unavailable\" }"
  typed.run("one-outcome-union", oneOutcomeUnion, {
    valid: [
      // the one union, in its slot (one-app repository and shared package)
      { filename: API_OUTCOME, code: UNION },
      { filename: PKG_OUTCOME, code: UNION },
      // composing the one union is not declaring another
      { filename: HOOK, code: "import type { Outcome } from \"../../modules/api/outcome\"\nexport type CourseRead = Outcome<{ id: string }>" },
      { filename: HOOK, code: "import type { Outcome } from \"../../modules/api/outcome\"\nexport type Failed = Exclude<Outcome<string>, { ok: true }>" },
      // UI state unions are not result vocabulary: their discriminant is `status`, `state`, `type`
      { filename: HOOK, code: "export type Saving = { status: \"idle\" } | { status: \"saving\" } | { status: \"saved\"; at: number }" },
      { filename: HOOK, code: "export type Step = { state: \"open\" } | { state: \"done\" }" },
      { filename: HOOK, code: "export type Field = { type: \"text\"; value: string } | { type: \"number\"; value: number }" },
      // a `kind` union whose values are not result kinds (tree nodes, menu items)
      { filename: HOOK, code: "export type Node = { kind: \"folder\"; children: string[] } | { kind: \"file\"; size: number }" },
      // a view a mapper derives from the Outcome (no `ok` arm) is a screen state: starci-next-fe LessonViewerView, StudyStepView
      { filename: at("apps/web/src/modules/api/learn-content/learn-content.mapper.ts"), code: "export type LessonViewerView = { kind: \"ready\"; lesson: string } | { kind: \"not-found\"; sectionHref: string } | { kind: \"unavailable\"; retryHref: string }" },
      { filename: HOOK, code: "export type StudyStepView = { kind: \"saved\" } | { kind: \"refused\"; code: string } | { kind: \"not-found\" }" },
      // an `ok` that is a plain boolean flag on each member is not a true/false discriminant
      { filename: HOOK, code: "export type Flagged = { ok: boolean; a: 1 } | { ok: boolean; b: 2 }" },
      // not a union of objects, or not a union at all
      { filename: HOOK, code: "export type Mode = \"a\" | \"b\"" },
      { filename: HOOK, code: "export type Maybe = { ok: true } | null" },
      { filename: HOOK, code: "export type Row = { ok: true; a: 1 }" },
      { filename: HOOK, code: "export interface Reply { ok: boolean }" },
    ],
    invalid: [
      { filename: HOOK, code: "export type SignOutOutcome = { ok: true } | { ok: false; kind: \"refused\" }", errors: [{ messageId: "second" }] },
      // named nothing like a result: the structure decides
      { filename: HOOK, code: "export type Thing<T> = { ok: true; value: T } | { ok: false; reason: string }", errors: [{ messageId: "second" }] },
      { filename: HOOK, code: "type Reply = { ok: true } | { ok: false }", errors: [{ messageId: "second" }] },
      // the discriminant is `kind` in the Outcome vocabulary
      { filename: HOOK, code: "export type Save = { kind: \"ok\"; id: string } | { kind: \"refused\" } | { kind: \"invalid\"; field: string }", errors: [{ messageId: "second" }] },
      { filename: HOOK, code: "export type Read = { kind: \"ok\"; value: string } | { kind: \"unavailable\" } | { kind: \"not-found\" }", errors: [{ messageId: "second" }] },
      // members declared apart and joined: the checker resolves them
      { filename: HOOK, code: "type Won = { ok: true; id: string }\ntype Lost = { ok: false; kind: \"invalid\" }\nexport type Attempt = Won | Lost", errors: [{ messageId: "second" }] },
      // an intersection member is still an object type
      { filename: HOOK, code: "type Base = { at: number }\nexport type Stamped = (Base & { ok: true }) | (Base & { ok: false })", errors: [{ messageId: "second" }] },
      // the one union with an arm added is a second union
      {
        filename: HOOK,
        code: "import type { Outcome } from \"../../modules/api/outcome\"\nexport type Invite = Outcome<string> | { ok: false; kind: \"conflict\" }",
        errors: [{ messageId: "second" }],
      },
      // in another app and in a package that is not the api package
      { filename: at("apps/admin/src/hooks/course/useCourse.ts"), code: "export type Save = { ok: true } | { ok: false }", errors: [{ messageId: "second" }] },
      { filename: at("packages/nivo-ui/src/leaves/Menu/index.tsx"), code: "export type Save = { ok: true } | { ok: false }", errors: [{ messageId: "second" }] },
      // another file of the api layer is not the outcome file
      { filename: CLIENT, code: UNION, errors: [{ messageId: "second" }] },
      { filename: PKG_CLIENT, code: UNION, errors: [{ messageId: "second" }] },
      { filename: at("apps/web/src/modules/api/course/read-course.ts"), code: UNION, errors: [{ messageId: "second" }] },
    ],
  })
})
