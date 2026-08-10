/**
 * Twin tests for the translation rules.
 *
 *   node --test translation.test.mjs
 *
 * The prose test is crude on purpose - a space and a leading capital - so the cases that earn their
 * place are the ones that separate a SENTENCE from a token. `"search"` is an icon name, `"sm"` is a
 * size, `"Search courses"` is copy. A rule that fired on the first two would be disabled within a
 * week, and a disabled rule protects nothing.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noCopyResolutionBelowBlock, noHardcodedCopyInVocabulary, rules } from "./translation.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const LEAF = "D:/repo/src/components/leaves/Input/index.tsx"
const COMPOSITE = "D:/repo/src/components/composites/SearchBox/index.tsx"
const BLOCK = "D:/repo/src/components/blocks/dashboard/DailyQuest/index.tsx"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("COPY-1: a tier that receives its words never resolves one", () => {
  tester.run("no-copy-resolution-below-block", noCopyResolutionBelowBlock, {
    valid: [
      { filename: LEAF, code: "const E = ({ props }) => props.label" },
      // the connected half is where the word is chosen
      { filename: BLOCK, code: "const t = useTranslations(\"quest\")" },
    ],
    invalid: [
      { filename: LEAF, code: "const t = useTranslations(\"input\")", errors: [{ messageId: "resolves" }] },
      { filename: COMPOSITE, code: "const l = useLocale()", errors: [{ messageId: "resolves" }] },
    ],
  })
})

test("COPY-2: no visible or spoken literal in a tier that receives its words", () => {
  tester.run("no-hardcoded-copy-in-vocabulary", noHardcodedCopyInVocabulary, {
    valid: [
      // tokens, not sentences: a name, a size, a variant
      { filename: LEAF, code: "const E = () => <Icon props={{ name: \"search\", size: \"sm\" }} />" },
      { filename: LEAF, code: "const E = ({ props }) => <input placeholder={props.placeholder} />" },
      { filename: LEAF, code: "const E = ({ props }) => <span aria-label={props.label} />" },
      // a lone lowercase word is a token, not copy
      { filename: LEAF, code: "const E = () => <span data-part=\"date\" />" },
      // a block MAY hold copy: it is the half that resolves it
      { filename: BLOCK, code: "const E = () => <input placeholder=\"Search courses\" />" },
    ],
    invalid: [
      {
        filename: LEAF,
        code: "const E = () => <input placeholder=\"Search courses\" />",
        errors: [{ messageId: "hardcoded" }],
      },
      {
        // the loudest case for the reader least able to work around it
        filename: LEAF,
        code: "const E = () => <button aria-label=\"Close the dialog\" />",
        errors: [{ messageId: "hardcoded" }],
      },
      {
        filename: COMPOSITE,
        code: "const E = () => <span>Nothing to show yet</span>",
        errors: [{ messageId: "text" }],
      },
    ],
  })
})
