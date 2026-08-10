/**
 * Twin tests for the naming rules.
 *
 *   node --test naming.test.mjs
 *
 * `no-version-in-name` is the one with room to be wrong: a capital V followed by digits appears
 * inside perfectly good names, and it appears inside STRING values constantly (`claude-sonnet-5`,
 * an API version in a URL). The rule reads identifiers only, and the valid cases below are what
 * pins that down.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noBareVerbExport, noVersionInName, rules } from "./naming.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  },
})

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("NAME-2: a schema generation does not go in a name", () => {
  tester.run("no-version-in-name", noVersionInName, {
    valid: [
      "class ContentParserService { async hasVerifiedMarker() { return true } }",
      "export interface ContentLookupParams { relativePath: string }",
      // a version in a STRING is data, not a name
      "const model = 'claude-sonnet-5'",
      // a name that merely contains a capital V followed by a letter
      "export class VerifiedMarkerService {}",
    ],
    invalid: [
      {
        code: "class ContentParserService { async isV2() { return true } }",
        errors: [{ messageId: "versioned" }],
      },
      {
        code: "export interface IsContentV2Params { relativePath: string }",
        errors: [{ messageId: "versioned" }],
      },
      {
        code: "export class SchemaV3Reader {}",
        errors: [{ messageId: "versioned" }],
      },
    ],
  })
})

test("NAME-5: an exported function names its object", () => {
  tester.run("no-bare-verb-export", noBareVerbExport, {
    valid: [
      "export const askModel = () => null",
      "export const parseContentBody = () => null",
      "export function buildTranscript() { return [] }",
      // a bare verb that is NOT exported is local vocabulary
      "const generate = () => null",
      // not a function
      "export const generateLimit = 3",
    ],
    invalid: [
      { code: "export const generate = () => null", errors: [{ messageId: "bareVerb" }] },
      { code: "export function parse() { return null }", errors: [{ messageId: "bareVerb" }] },
      { code: "export const run = async () => null", errors: [{ messageId: "bareVerb" }] },
    ],
  })
})
