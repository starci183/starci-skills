/**
 * Twin tests for the list rules (`FE_LIST_KEY`, under R65).
 *
 *   node --test lists.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { listItemHasKey, noIndexKey, noInlineLiteralPropInList, rules } from "./lists.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const FILE = "D:/repo/src/components/blocks/Feed/component.tsx"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("LISTS-1: every element a map returns carries a key", () => {
  tester.run("list-item-has-key", listItemHasKey, {
    valid: [
      { filename: FILE, code: "const A = () => rows.map((row) => <li key={row.id}>{row.name}</li>)" },
      { filename: FILE, code: "const A = () => rows.map((row) => { return <Row key={row.id} row={row} /> })" },
      { filename: FILE, code: "const A = () => rows.map((row) => <Fragment key={row.id}><a /><b /></Fragment>)" },
      { filename: FILE, code: "const A = () => rows.map((row) => row.id)" },
      { filename: FILE, code: "const A = () => Children.map(children, (child) => <div>{child}</div>)" },
      { filename: FILE, code: "const A = () => rows.map((row) => (row.ok ? <Ok key={row.id} /> : <Bad key={row.id} />))" },
    ],
    invalid: [
      { filename: FILE, code: "const A = () => rows.map((row) => <li>{row.name}</li>)", errors: [{ messageId: "missing" }] },
      { filename: FILE, code: "const A = () => rows.map((row) => <Row row={row} />)", errors: [{ messageId: "missing" }] },
      { filename: FILE, code: "const A = () => rows.map((row) => <><a /><b /></>)", errors: [{ messageId: "fragment" }] },
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => { if (!row.ok) return <Bad />; return <Ok key={row.id} /> })",
        errors: [{ messageId: "missing" }],
      },
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => (row.ok ? <Ok key={row.id} /> : <Bad />))",
        errors: [{ messageId: "missing" }],
      },
    ],
  })
})

test("LISTS-2: the key is stable data, never the index or a random value", () => {
  tester.run("no-index-key", noIndexKey, {
    valid: [
      { filename: FILE, code: "const A = () => rows.map((row, index) => <li key={row.id}>{index}</li>)" },
      { filename: FILE, code: "const A = () => [0, 1, 2].map((n, index) => <Skeleton key={index} />)" },
      { filename: FILE, code: "const A = () => SKELETON_ROWS.map((_, index) => <Skeleton key={index} />)" },
      { filename: FILE, code: "const A = () => rows.map((row) => <li key={row.id} />)" },
    ],
    invalid: [
      { filename: FILE, code: "const A = () => rows.map((row, index) => <li key={index}>{row}</li>)", errors: [{ messageId: "index" }] },
      { filename: FILE, code: "const A = () => rows.map((row, i) => <li key={`row-${i}`}>{row}</li>)", errors: [{ messageId: "index" }] },
      { filename: FILE, code: "const A = () => rows.map((row, i) => <li key={row.id + i}>{row}</li>)", errors: [{ messageId: "index" }] },
      { filename: FILE, code: "const A = () => rows.map((row) => <li key={Math.random()}>{row}</li>)", errors: [{ messageId: "random" }] },
      { filename: FILE, code: "const A = () => rows.map((row) => <li key={crypto.randomUUID()}>{row}</li>)", errors: [{ messageId: "random" }] },
    ],
  })
})

test("LISTS-3: no object or array literal prop on a component inside a map", () => {
  tester.run("no-inline-literal-prop-in-list", noInlineLiteralPropInList, {
    valid: [
      { filename: FILE, code: "const A = () => rows.map((row) => <Row key={row.id} row={row} />)" },
      { filename: FILE, code: "const A = () => rows.map((row) => <div key={row.id} style={{ color: 'red' }} />)" },
      { filename: FILE, code: "const A = () => <Card props={{ a: 1 }} />" },
      { filename: FILE, code: "const A = () => rows.map((row) => <Row key={row.id} onPick={() => pick(row)} />)" },
      { filename: FILE, code: "const A = () => rows.map((row) => <Row key={row.id} tags={[]} />)" },
      { filename: FILE, code: "const A = () => <List render={() => <Row cells={[1, 2]} />} />" },
    ],
    invalid: [
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => <Avatar key={row.id} props={{ size: 'sm' }} />)",
        errors: [{ messageId: "literal" }],
      },
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => <Row key={row.id} columns={['a', 'b']} />)",
        errors: [{ messageId: "literal" }],
      },
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => <ui.Row key={row.id} options={{ dense: true }} />)",
        errors: [{ messageId: "literal" }],
      },
      {
        filename: FILE,
        code: "const A = () => rows.map((row) => <li key={row.id}><Badge tone={{ kind: 'x' }} /></li>)",
        errors: [{ messageId: "literal" }],
      },
    ],
  })
})
