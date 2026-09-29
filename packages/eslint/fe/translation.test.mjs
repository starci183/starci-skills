/**
 * Twin tests for the translation rules.
 *
 *   node --test translation.test.mjs
 *
 * The cases that earn their place are the ones that separate a SENTENCE from a TOKEN in an object or
 * a generic prop (`"sm"` is a size, `"Search courses"` is copy), and the ones where a block used to
 * be exempt and the pragma used to excuse a literal.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noCopyResolutionBelowBlock, noHardcodedCopy, rules } from "./translation.mjs"

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
const FIXTURE = "D:/repo/src/components/blocks/Feed/fixtures/copy.ts"
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

test("COPY-2: no literal copy at any tier, in any language, and no pragma", () => {
  tester.run("no-hardcoded-copy", noHardcodedCopy, {
    valid: [
      // tokens, not sentences: a name, a size, a variant
      { filename: LEAF, code: "const E = () => <Icon props={{ name: \"search\", size: \"sm\" }} />" },
      { filename: LEAF, code: "const E = () => <span data-part=\"date\" />" },
      // words arrive through props or t()
      { filename: LEAF, code: "const E = ({ props }) => <input placeholder={props.placeholder} />" },
      { filename: LEAF, code: "const E = ({ props }) => <span aria-label={props.label} />" },
      { filename: BLOCK, code: "const E = () => <input placeholder={t(\"search\")} />" },
      { filename: BLOCK, code: "const E = () => <h1>{t(\"title\")}</h1>" },
      // punctuation, digits and whitespace carry no word
      { filename: BLOCK, code: "const E = () => <span>·</span>" },
      { filename: BLOCK, code: "const E = () => <span>{\" \"}</span>" },
      { filename: BLOCK, code: "const E = () => <span>12 / 40</span>" },
      // a lone letter is a unit or a key cap, not a word (the repository gate draws the same line)
      { filename: BLOCK, code: "const E = () => <kbd>K</kbd>" },
      // a token in an object is not copy
      { filename: BLOCK, code: "const o = { title: \"sm\", label: \"date\" }" },
      // a key that is not a copy key is not copy
      { filename: BLOCK, code: "const o = { kind: \"Search courses\" }" },
      // catalogue keys are lower-case dotted tokens
      { filename: BLOCK, code: "const o = { title: t(\"course.title\") }" },
      // the dictionaries and fixtures are content
      { filename: FIXTURE, code: "const t = \"Tiếp tục học\"" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "const E = () => <p>Tiếp tục học</p>" },
      // English comments are the rule
      { filename: BLOCK, code: "// the reason this exists\nconst x = 1" },
    ],
    invalid: [
      // a block is not exempt any more
      { filename: BLOCK, code: "const E = () => <p>Nothing to show yet</p>", errors: [{ messageId: "text" }] },
      { filename: BLOCK, code: "const E = () => <button>Save</button>", errors: [{ messageId: "text" }] },
      { filename: BLOCK, code: "const E = () => <p>{\"Loading\"}</p>", errors: [{ messageId: "text" }] },
      { filename: BLOCK, code: "const E = () => <p>Tiếp tục học</p>", errors: [{ messageId: "text" }] },
      {
        filename: LEAF,
        code: "const E = () => <input placeholder=\"Search courses\" />",
        errors: [{ messageId: "attribute" }],
      },
      {
        // the loudest case for the reader least able to work around it
        filename: LEAF,
        code: "const E = () => <button aria-label=\"Close the dialog\" />",
        errors: [{ messageId: "attribute" }],
      },
      // a lone word in a spoken attribute is still copy
      { filename: BLOCK, code: "const E = () => <img alt=\"logo\" />", errors: [{ messageId: "attribute" }] },
      { filename: BLOCK, code: "const E = () => <a title={\"Open\"} />", errors: [{ messageId: "attribute" }] },
      // a generic prop that reads as prose
      { filename: BLOCK, code: "const E = () => <Field label=\"Email address\" />", errors: [{ messageId: "attribute" }] },
      // `label` is a spoken attribute: any word in it is copy
      { filename: BLOCK, code: "const E = () => <Field label=\"sm\" />", errors: [{ messageId: "attribute" }] },
      // copy in an object
      { filename: BLOCK, code: "const o = { title: \"Your courses\" }", errors: [{ messageId: "property" }] },
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "export const metadata = { description: \"Learn to code\" }", errors: [{ messageId: "property" }] },
      // the second language, wherever it hides, with no pragma to excuse it
      { filename: BLOCK, code: "const message = \"hạn cuối đã qua\"", errors: [{ messageId: "second" }] },
      { filename: BLOCK, code: "const message = `hạn cuối đã qua ${x}`", errors: [{ messageId: "second" }] },
      { filename: BLOCK, code: "// hạn cuối đã qua\nconst x = 1", errors: [{ messageId: "comment" }] },
      { filename: BLOCK, code: "const LABEL = \"Tiếng Việt\"", errors: [{ messageId: "second" }] },
      {
        // vn-ok was the escape hatch; it excuses nothing now
        filename: BLOCK,
        code: "// vn-ok: the server sends this verbatim\nconst S = \"Đã huỷ\"",
        errors: [{ messageId: "second" }],
      },
    ],
  })
})
