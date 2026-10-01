/**
 * Twin tests for the resilience rules.
 *
 *   node --test resilience.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { httpNeedsTimeout, jsonParseNeedsGuard, noHandRolledRetry, rules } from "./resilience.mjs"

const tester = typedTester()
const SRC = at("src/modules/integrations/mailer/mail.client.ts")
const SPEC = at("src/modules/integrations/mailer/mail.client.spec.ts")
const AXIOS = 'import axios from "axios"\nimport { HttpService } from "@nestjs/axios"\n'

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R70: an outbound HTTP call states how long it may take", () => {
  tester.run("http-needs-timeout", httpNeedsTimeout, {
    valid: [
      { filename: SRC, code: "await fetch(url, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) })" },
      { filename: SRC, code: "await fetch(url, { ...init })" },
      { filename: SRC, code: `${AXIOS}await axios.get(url, { timeout: TIMEOUT_MS })` },
      { filename: SRC, code: `${AXIOS}await axios.post(url, body, { timeout: TIMEOUT_MS })` },
      { filename: SRC, code: `${AXIOS}class C { constructor(private readonly client: HttpService) {} run() { return this.client.get(url, { signal }) } }` },
      { filename: SRC, code: `${AXIOS}const client = axios.create({ baseURL, timeout: TIMEOUT_MS })` },
      // a config held in a variable cannot be judged from syntax
      { filename: SRC, code: `${AXIOS}await axios.get(url, config)` },
      // a receiver that is not an HTTP client is not judged, whatever it is called
      { filename: SRC, code: "const found = items.get(key)" },
      { filename: SRC, code: "const axios = { get: (url: string) => url }\nawait axios.get(url)" },
      { filename: SRC, code: "http.get(url, callback)" },
    ],
    invalid: [
      { filename: SRC, code: "await fetch(url)", errors: [{ messageId: "fetchNoSignal" }] },
      { filename: SRC, code: "await fetch(url, { method: 'POST', body })", errors: [{ messageId: "fetchNoSignal" }] },
      { filename: SRC, code: `${AXIOS}await axios.get(url)`, errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: `${AXIOS}await axios.post(url, body)`, errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: `${AXIOS}await axios.post(url, body, { headers })`, errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: `${AXIOS}class C { constructor(private readonly client: HttpService) {} run() { return this.client.get(url, { headers }) } }`, errors: [{ messageId: "clientNoTimeout" }] },
      // a renamed receiver is still judged by its type
      { filename: SRC, code: `${AXIOS}const wire = axios\nawait wire.get(url)`, errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: `${AXIOS}const client = axios.create({ baseURL })`, errors: [{ messageId: "createNoTimeout" }] },
      // specs are not exempt
      { filename: SPEC, code: "await fetch(url)", errors: [{ messageId: "fetchNoSignal" }] },
    ],
  })
})

test("R76: JSON.parse of outside text fails inside a guard", () => {
  tester.run("json-parse-needs-guard", jsonParseNeedsGuard, {
    valid: [
      { filename: SRC, code: "function read(text: string) { try { return JSON.parse(text) } catch (error) { return null } }" },
      { filename: SRC, code: "const read = (text: string) => { try { return JSON.parse(text) } catch { throw new ParseError() } }" },
      { filename: SRC, code: "const copy = JSON.stringify(value)" },
    ],
    invalid: [
      { filename: SRC, code: "const body = JSON.parse(text)", errors: [{ messageId: "unguarded" }] },
      { filename: SRC, code: "function read(text: string) { return JSON.parse(text) }", errors: [{ messageId: "unguarded" }] },
      // a try in an outer function does not cover an inner one
      { filename: SRC, code: "try { items.map((text: string) => JSON.parse(text)) } catch (error) { throw error }", errors: [{ messageId: "unguarded" }] },
      // the catch block is not the guarded block
      { filename: SRC, code: "try { run() } catch (error) { JSON.parse(text) }", errors: [{ messageId: "unguarded" }] },
      // specs are not exempt
      { filename: SPEC, code: "const body = JSON.parse(text)", errors: [{ messageId: "unguarded" }] },
    ],
  })
})

const RETRY_SRC = at("src/modules/platform/retry/retry.service.ts")
const HELPER = 'import { hold, label, Napper } from "@modules/domain/order/order.pause.policy"\nimport { pause } from "@modules/platform/retry/retry.service"\n'

test("R81: a loop that catches an error and waits goes through platform/retry", () => {
  tester.run("no-hand-rolled-retry", noHandRolledRetry, {
    valid: [
      // a polling loop with no catch is not a retry
      { name: "r81 1", filename: SRC, code: `${HELPER}while (!isReady()) { await hold(POLL_MS) }` },
      // a catch with no wait just handles the error once, even when a call is named like a delay
      { name: "r81 2", filename: SRC, code: "for (const id of ids) { try { run(id) } catch (error) { report(error) } }" },
      { name: "r81 3", filename: SRC, code: "for (const id of ids) { try { await sleep(id) } catch (error) { report(error) } }" },
      // a helper that does not wait is not a wait, whatever its name says
      { name: "r81 4", filename: SRC, code: `${HELPER}for (const id of ids) { try { run(id) } catch (error) { report(label(id)) } }` },
      // the wait of the platform/retry owner is the sanctioned one
      { name: "r81 5", filename: SRC, code: `${HELPER}for (const id of ids) { try { run(id) } catch (error) { await pause(1) } }`, name: "sanctioned pause" },
      // the shared helper itself may loop, catch and wait
      { name: "r81 6", filename: RETRY_SRC, code: "for (let i = 0; i < max; i++) { try { return await fn() } catch (e) { await new Promise((resolve) => setTimeout(resolve, 5)) } }" },
      // a timer in a nested function of a loop with no catch
      { name: "r81 7", filename: SRC, code: "for (const id of ids) { setTimeout(() => run(id), 5) }" },
    ],
    invalid: [
      // the wait is a global timer inside a promise executor
      {
        name: "r81 8", filename: SRC,
        code: "while (true) { try { return await fn() } catch (e) { await new Promise((resolve) => setTimeout(resolve, delayMs)) } }",
        errors: [{ messageId: "handRolled" }],
      },
      // the wait is a function declared elsewhere under an unremarkable name: judged by its body, not its name
      {
        name: "r81 9", filename: SRC,
        code: `${HELPER}for (let i = 0; i < max; i++) { try { return await fn() } catch (e) { await hold(backoffMs(i)) } }`,
        errors: [{ messageId: "handRolled" }],
      },
      // a method that waits
      {
        name: "r81 10", filename: SRC,
        code: `${HELPER}const napper = new Napper()\ndo { try { return await fn() } catch (e) { await napper.rest(5) } } while (attempts++ < max)`,
        errors: [{ messageId: "handRolled" }],
      },
      // a local helper that waits
      {
        name: "r81 11", filename: SRC,
        code: "const nap = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))\nfor (const id of ids) { try { await run(id) } catch (e) { await nap(5) } }",
        errors: [{ messageId: "handRolled" }],
      },
      // a timers/promises import under any local name
      {
        name: "r81 12", filename: SRC,
        code: "import { setTimeout as later } from 'node:timers/promises'\nwhile (true) { try { return await fn() } catch (e) { await later(50) } }",
        errors: [{ messageId: "handRolled" }],
      },
      // the catch is a promise `.catch`
      {
        name: "r81 13", filename: SRC,
        code: `${HELPER}declare const run: (id: string) => Promise<void>\nfor (const id of ids) { await run(id).catch(() => undefined)\n await hold(5) }`,
        errors: [{ messageId: "handRolled" }],
      },
      // for-of loops retry too, and specs are not exempt
      {
        name: "r81 14", filename: SPEC,
        code: `${HELPER}for (const attempt of attempts) { try { return await fn() } catch (e) { await hold(attempt) } }`,
        errors: [{ messageId: "handRolled" }],
      },
    ],
  })
})
