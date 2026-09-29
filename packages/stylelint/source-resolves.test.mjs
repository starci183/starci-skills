import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { lintRule } from "./testing.mjs"

/** A throwaway app: `<tmp>/src/app/globals.css` beside `<tmp>/src/components` and `<tmp>/node_modules/@starci/grammar`. */
function app(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "starci-source-"))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.mkdirSync(path.join(dir, "src", "app"), { recursive: true })
  fs.mkdirSync(path.join(dir, "src", "components"), { recursive: true })
  fs.mkdirSync(path.join(dir, "node_modules", "@starci", "grammar"), { recursive: true })
  return path.join(dir, "src", "app", "globals.css")
}

const rule = (code, file) => lintRule("source-resolves", code, file)

test("accepts a path, a glob and a package folder that exist", async (t) => {
  const file = app(t)
  assert.deepEqual(await rule('@source "../components";', file), [])
  assert.deepEqual(await rule('@source "../**/*.tsx";', file), [])
  assert.deepEqual(await rule('@source "../components/*.tsx";', file), [])
  assert.deepEqual(await rule("@source '../../node_modules/@starci/grammar';", file), [])
})

test("refuses a path that resolves to nothing, the way a wrong node_modules path does", async (t) => {
  const file = app(t)
  const warnings = await rule('@source "../../../node_modules/@starci/grammar";', file)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0].text, /resolves to nothing/)
  assert.equal((await rule('@source "../missing/**/*.tsx";', file)).length, 1)
  assert.equal((await rule('@source not "../nope";', file)).length, 1)
})

test("skips inline sources", async (t) => {
  const file = app(t)
  assert.deepEqual(await rule('@source inline("underline");', file), [])
})
