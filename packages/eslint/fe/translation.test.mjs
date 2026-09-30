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
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { noCopyResolutionBelowBlock, noHardcodedCopy, rules } from "./translation.mjs"

const tester = slotTester()

const LEAF = at("apps/web/src/components/leaves/Input/index.tsx")
const COMPOSITE = at("apps/web/src/components/composites/SearchBox/index.tsx")
const FIXTURE = at("e2e/fixtures/copy.ts")
const BLOCK = at("apps/web/src/components/blocks/DailyQuest/index.tsx")

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("COPY-1: a tier that receives its words never resolves one", () => {
  tester.run("no-copy-resolution-below-block", noCopyResolutionBelowBlock, {
    valid: [
      // a block resolves copy; a folder named leaves inside a module is not a vocabulary layer
      { filename: at("apps/web/src/modules/leaves/index.ts"), code: "const t = useTranslations(\"input\")" },
      { filename: LEAF, code: "const E = ({ props }) => props.label" },
      // the connected half is where the word is chosen
      { filename: BLOCK, code: "const t = useTranslations(\"quest\")" },
    ],
    invalid: [
      { filename: LEAF, code: "const t = useTranslations(\"input\")", errors: [{ messageId: "resolves" }] },
      { filename: at("packages/nivo-ui/src/leaves/Input/index.tsx"), code: "const t = useTranslations(\"input\")", errors: [{ messageId: "resolves" }] },
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
      // a key that is not a copy key carries copy only when the value is a whole sentence: tokens, classes, ids, media types and formats are not
      { filename: BLOCK, code: "const o = { kind: \"not-found\", method: \"GET\", accept: \"application/json\" }" },
      { filename: BLOCK, code: "const o = { root: \"flex items-center gap-2\", size: \"sm\", mode: \"Dark\" }" },
      { filename: BLOCK, code: "const o = { format: \"YYYY-MM-DD HH:mm\", pattern: \"dd/MM/yyyy\", url: \"/courses/list\" }" },
      // templates that are not copy: class names, urls, keys, ids, units, format tokens
      { filename: BLOCK, code: "const E = () => <div className={`btn ${size} btn-${tone}`} />" },
      { filename: BLOCK, code: "const E = () => <a href={`/courses/${id}/lessons`}>{t(\"open\")}</a>" },
      { filename: BLOCK, code: "const E = () => <span>{`${a}-${b}`}</span>" },
      { filename: BLOCK, code: "const E = () => <span>{`${x} / ${y}`}</span>" },
      { filename: BLOCK, code: "const E = () => <span style={{ width: `${pct}%` }} />" },
      { filename: BLOCK, code: "const E = () => <input placeholder={`${a}${b}`} />" },
      { filename: BLOCK, code: "const key = `course:${id}:lesson`; const o = { id: `row-${n}`, path: `/a/${b}` }" },
      { filename: BLOCK, code: "const o = { title: `${a}-${b}`, label: `${n}px` }" },
      // a template resolved through t() is not a literal
      { filename: BLOCK, code: "const E = () => <p>{t(\"installed\", { count })}</p>" },
      // catalogue keys are lower-case dotted tokens
      { filename: BLOCK, code: "const o = { title: t(\"course.title\") }" },
      // the dictionaries and fixtures are content
      { filename: FIXTURE, code: "const t = \"Tiếp tục học\"" },
      { filename: at("apps/web/src/components/blocks/Feed/index.test.tsx"), code: "const E = () => <p>Tiếp tục học</p>" },
      // a fixture inside a component owner is authoring, not content
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
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "export const metadata = { description: \"Learn to code\" }", errors: [{ messageId: "property" }] },
      // a template with substitutions whose static parts hold a word is copy: JSX child, spoken attribute, prose attribute
      { filename: BLOCK, code: "const E = () => <p>{`${count} installed`}</p>", errors: [{ messageId: "text" }] },
      { filename: BLOCK, code: "const E = () => <p>{`You have ${c} unread messages`}</p>", errors: [{ messageId: "text" }] },
      { filename: LEAF, code: "const E = () => <button aria-label={`Close ${name}`} />", errors: [{ messageId: "attribute" }] },
      { filename: BLOCK, code: "const E = () => <Field hint={`Up to ${max} characters`} />", errors: [{ messageId: "attribute" }] },
      // a template as a copy-key value
      { filename: BLOCK, code: "const o = { title: `Welcome back, ${name}` }", errors: [{ messageId: "property" }] },
      // any key: a whole sentence is copy (a hook returning its own status text)
      { filename: BLOCK, code: "const s = { ready: \"Your course is ready\" }", errors: [{ messageId: "property" }] },
      { filename: at("apps/web/src/hooks/lesson/useLesson.ts"), code: "export const useLesson = () => ({ status: \"Loading your lesson\", error: \"Something went wrong.\" })", errors: [{ messageId: "property" }, { messageId: "property" }] },
      { filename: at("apps/web/src/modules/notify/messages.ts"), code: "export const M = { saved: `Saved ${n} items`, kind: \"Search courses\" }", errors: [{ messageId: "property" }, { messageId: "property" }] },
    ],
  })
})
