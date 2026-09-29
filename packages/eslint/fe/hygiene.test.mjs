/**
 * Twin tests for the hygiene rules (`FE_EFFECT_CLEANUP`, `FE_EFFECT_FETCH`, `FE_SWALLOWED_ERROR`, `FE_CONSOLE_CALL`).
 *
 *   node --test hygiene.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noConsole, noDataFetchInEffect, noEmptyCatch, rules, timerNeedsEffectCleanup } from "./hygiene.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const FILE = "D:/repo/src/components/blocks/Feed/index.tsx"
const MODULE = "D:/repo/src/modules/api/client.ts"
const SPEC = "D:/repo/src/components/blocks/Feed/index.test.tsx"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("HYGIENE-1: a timer lives in an effect that clears it", () => {
  tester.run("timer-needs-effect-cleanup", timerNeedsEffectCleanup, {
    valid: [
      {
        filename: FILE,
        code: "useEffect(() => { const id = setTimeout(() => set(false), 300); return () => clearTimeout(id) }, [])",
      },
      {
        filename: FILE,
        code: "React.useEffect(() => { const id = window.setInterval(tick, 1000); return () => { window.clearInterval(id) } }, [])",
      },
      // a module owns its timer and clears it in finally
      { filename: MODULE, code: "const id = setTimeout(() => controller.abort(), 5000); try { await run() } finally { clearTimeout(id) }" },
      { filename: SPEC, code: "setTimeout(done, 10)" },
    ],
    invalid: [
      { filename: FILE, code: "const onClick = () => { setTimeout(() => set(false), 300) }", errors: [{ messageId: "orphan" }] },
      { filename: FILE, code: "window.setTimeout(refresh, 1000)", errors: [{ messageId: "orphan" }] },
      { filename: FILE, code: "useEffect(() => { setTimeout(() => set(false), 300) }, [])", errors: [{ messageId: "noCleanup" }] },
      {
        filename: FILE,
        code: "useEffect(() => { const id = setInterval(tick, 1000); return () => undefined }, [])",
        errors: [{ messageId: "noCleanup" }],
      },
      {
        filename: FILE,
        code: "useLayoutEffect(() => { const id = setTimeout(a, 1); return undefined }, [])",
        errors: [{ messageId: "noCleanup" }],
      },
    ],
  })
})

test("HYGIENE-2: an effect does not load data", () => {
  tester.run("no-data-fetch-in-effect", noDataFetchInEffect, {
    valid: [
      { filename: FILE, code: "useEffect(() => { document.title = title }, [title])" },
      { filename: FILE, code: "useEffect(() => { const off = subscribe(handler); return () => off() }, [])" },
      { filename: FILE, code: "const { data } = useSWR(key, fetcher)" },
      // the cleanup may be async-looking; it is not the effect's own work
      { filename: FILE, code: "useEffect(() => { start(); return () => { void stop().then(noop) } }, [])" },
      { filename: SPEC, code: "useEffect(() => { void load().then(set) }, [])" },
    ],
    invalid: [
      { filename: FILE, code: "useEffect(() => { fetch('/x').then(set) }, [])", errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: "useEffect(() => { void (async () => { set(await load()) })() }, [])", errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: "useEffect(() => { load().then(set) }, [])", errors: [{ messageId: "fetch" }] },
      { filename: FILE, code: "React.useEffect(() => { void client.read().then(set) }, [])", errors: [{ messageId: "fetch" }] },
    ],
  })
})

test("HYGIENE-3: a catch that does nothing hides the failure", () => {
  tester.run("no-empty-catch", noEmptyCatch, {
    valid: [
      { filename: FILE, code: "try { run() } catch (error) { return { kind: 'unavailable', cause: error } }" },
      { filename: FILE, code: "try { run() } catch (error) { throw error }" },
      { filename: FILE, code: "load().catch((error) => report(error))" },
      { filename: FILE, code: "try { run() } finally { done() }" },
      { filename: SPEC, code: "try { run() } catch {}" },
    ],
    invalid: [
      { filename: FILE, code: "try { run() } catch {}", errors: [{ messageId: "empty" }] },
      { filename: FILE, code: "try { run() } catch (error) { /* ignore */ }", errors: [{ messageId: "empty" }] },
      { filename: FILE, code: "load().catch(() => {})", errors: [{ messageId: "promise" }] },
      { filename: FILE, code: "load().catch(() => undefined)", errors: [{ messageId: "promise" }] },
    ],
  })
})

test("HYGIENE-4: no console in product source", () => {
  tester.run("no-console", noConsole, {
    valid: [
      { filename: FILE, code: "const consoleWidth = 80" },
      { filename: FILE, code: "logger.error('x')" },
      { filename: SPEC, code: "console.log('debug')" },
      { filename: "D:/repo/scripts/build.mjs", code: "console.log('building')" },
    ],
    invalid: [
      { filename: FILE, code: "console.log('x')", errors: [{ messageId: "console" }] },
      { filename: FILE, code: "console.error(error)", errors: [{ messageId: "console" }] },
      { filename: MODULE, code: "console.warn('slow')", errors: [{ messageId: "console" }] },
    ],
  })
})
