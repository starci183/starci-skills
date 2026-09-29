/**
 * Twin tests for the resilience rules.
 *
 *   node --test resilience.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { httpNeedsTimeout, jsonParseNeedsGuard, noHandRolledRetry, rules } from "./resilience.mjs"

const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" },
})
const SRC = "D:/repo/src/modules/integrations/mail/mail.client.ts"
const SPEC = "D:/repo/src/modules/integrations/mail/mail.client.spec.ts"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R70: an outbound HTTP call states how long it may take", () => {
  tester.run("http-needs-timeout", httpNeedsTimeout, {
    valid: [
      { filename: SRC, code: "await fetch(url, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) })" },
      { filename: SRC, code: "await fetch(url, { ...init })" },
      { filename: SRC, code: "await axios.get(url, { timeout: TIMEOUT_MS })" },
      { filename: SRC, code: "await axios.post(url, body, { timeout: TIMEOUT_MS })" },
      { filename: SRC, code: "await this.httpService.get(url, { signal })" },
      { filename: SRC, code: "const client = axios.create({ baseURL, timeout: TIMEOUT_MS })" },
      // a config held in a variable cannot be judged from syntax
      { filename: SRC, code: "await axios.get(url, config)" },
      // Node's own http module is not an injected client
      { filename: SRC, code: "http.get(url, callback)" },
      { filename: SRC, code: "const found = items.get(key)" },
      { filename: SPEC, code: "await fetch(url)" },
    ],
    invalid: [
      { filename: SRC, code: "await fetch(url)", errors: [{ messageId: "fetchNoSignal" }] },
      { filename: SRC, code: "await fetch(url, { method: 'POST', body })", errors: [{ messageId: "fetchNoSignal" }] },
      { filename: SRC, code: "await axios.get(url)", errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: "await axios.post(url, body)", errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: "await axios.post(url, body, { headers })", errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: "await this.httpService.get(url, { headers })", errors: [{ messageId: "clientNoTimeout" }] },
      { filename: SRC, code: "const client = axios.create({ baseURL })", errors: [{ messageId: "createNoTimeout" }] },
    ],
  })
})

test("R76: JSON.parse of outside text fails inside a guard", () => {
  tester.run("json-parse-needs-guard", jsonParseNeedsGuard, {
    valid: [
      { filename: SRC, code: "function read(text) { try { return JSON.parse(text) } catch (error) { return null } }" },
      { filename: SRC, code: "const read = (text) => { try { return JSON.parse(text) } catch { throw new ParseError() } }" },
      { filename: SRC, code: "const copy = JSON.stringify(value)" },
      { filename: SPEC, code: "const body = JSON.parse(text)" },
    ],
    invalid: [
      { filename: SRC, code: "const body = JSON.parse(text)", errors: [{ messageId: "unguarded" }] },
      { filename: SRC, code: "function read(text) { return JSON.parse(text) }", errors: [{ messageId: "unguarded" }] },
      // a try in an outer function does not cover an inner one
      { filename: SRC, code: "try { items.map((text) => JSON.parse(text)) } catch (error) { throw error }", errors: [{ messageId: "unguarded" }] },
      // the catch block is not the guarded block
      { filename: SRC, code: "try { run() } catch (error) { JSON.parse(text) }", errors: [{ messageId: "unguarded" }] },
    ],
  })
})

const RETRY_SRC = "D:/repo/src/modules/platform/retry/retry.ts"

test("R81: a loop that catches an error and waits goes through platform/retry", () => {
  tester.run("no-hand-rolled-retry", noHandRolledRetry, {
    valid: [
      // a polling loop with no catch is not a retry
      { filename: SRC, code: "while (!isReady()) { await sleep(POLL_MS) }" },
      // a catch with no wait just handles the error once
      { filename: SRC, code: "for (const id of ids) { try { run(id) } catch (error) { report(error) } }" },
      // the shared helper itself
      { filename: RETRY_SRC, code: "for (let i = 0; i < max; i++) { try { return await fn() } catch (e) { await sleep(backoff(i)) } }" },
      // a spec drives its own fake timers
      { filename: SPEC, code: "for (let i = 0; i < max; i++) { try { return await fn() } catch (e) { await sleep(1) } }" },
    ],
    invalid: [
      {
        filename: SRC,
        code: "for (let i = 0; i < max; i++) { try { return await fn() } catch (e) { await sleep(backoffMs(i)) } }",
        errors: [{ messageId: "handRolled" }],
      },
      {
        filename: SRC,
        code: "while (true) { try { return await fn() } catch (e) { await new Promise((resolve) => setTimeout(resolve, delayMs)) } }",
        errors: [{ messageId: "handRolled" }],
      },
      {
        filename: SRC,
        code: "do { try { return await fn() } catch (e) { await delay(backoffMs) } } while (attempts++ < max)",
        errors: [{ messageId: "handRolled" }],
      },
    ],
  })
})
