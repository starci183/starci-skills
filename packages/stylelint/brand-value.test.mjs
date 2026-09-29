/**
 * The notion of a raw brand value is shared with `@starci/eslint-canon-fe` `no-raw-brand-value`. This twin test reads
 * that rule's source and fails when any of the three patterns differs from ours, so the two cannot drift.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { COLOR_FUNCTION, HEX_COLOR, PIXEL_LENGTH, findRawBrandValue } from "./lib/brand-value.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const ESLINT_RULE = path.resolve(here, "../eslint/fe/brand-values.mjs")
const present = fs.existsSync(ESLINT_RULE)

test("HEX_COLOR, COLOR_FUNCTION and PIXEL_LENGTH equal eslint-canon-fe's",
  { skip: present ? false : "packages/eslint/fe/brand-values.mjs is not in this checkout: lane/hfs2-canon-fe has not landed. The spec runs once it does." },
  () => {
    const source = fs.readFileSync(ESLINT_RULE, "utf8")
    const literal = (name) => {
      const match = new RegExp(`^const ${name} = (/.*/[a-z]*)$`, "m").exec(source)
      assert.ok(match, `${name} not found in brand-values.mjs`)
      return match[1]
    }
    assert.equal(String(HEX_COLOR), literal("HEX_COLOR"))
    assert.equal(String(COLOR_FUNCTION), literal("COLOR_FUNCTION"))
    assert.equal(String(PIXEL_LENGTH), literal("PIXEL_LENGTH"))
  },
)

test("findRawBrandValue classifies the same samples the TypeScript rule reports or leaves alone", () => {
  assert.deepEqual(findRawBrandValue("#ff0000"), { kind: "color", value: "#ff0000" })
  assert.deepEqual(findRawBrandValue("#abc"), { kind: "color", value: "#abc" })
  assert.deepEqual(findRawBrandValue("rgb(0 0 0)"), { kind: "color", value: "rgb(...)" })
  assert.deepEqual(findRawBrandValue("color-mix(in oklab, red, blue)"), { kind: "color", value: "color-mix(...)" })
  assert.deepEqual(findRawBrandValue("12px"), { kind: "length", value: "12px" })
  assert.deepEqual(findRawBrandValue("0 -1.5px"), { kind: "length", value: "-1.5px" })
  assert.equal(findRawBrandValue("#ffffff80")?.kind, "color")
  assert.equal(findRawBrandValue("#top"), null)
  assert.equal(findRawBrandValue("var(--accent)"), null)
  assert.equal(findRawBrandValue("12rem"), null)
  assert.equal(findRawBrandValue("w-[12px]"), null)
  assert.equal(findRawBrandValue("url(#add)"), null)
  assert.equal(findRawBrandValue(undefined), null)
})
