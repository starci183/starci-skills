/**
 * Twin tests for the native form control rule (HFS R62).
 *
 *   node --test native-controls.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { noNativeFormControl, rules } from "./native-controls.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const BLOCK = "D:/repo/src/components/blocks/Feed/index.tsx"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("NATIVE-1: no bare select, input, textarea or button in product source", () => {
  tester.run("no-native-form-control", noNativeFormControl, {
    valid: [
      { filename: BLOCK, code: "const E = () => <Button onPress={go}>{t(\"go\")}</Button>" },
      { filename: BLOCK, code: "const E = () => <Input value={v} onValueChange={set} />" },
      // a component that merely has a native name as a member is not the element
      { filename: BLOCK, code: "const E = () => <Form.Input />" },
      { filename: BLOCK, code: "const E = () => <div><span /></div>" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "const E = () => <button />" },
    ],
    invalid: [
      { filename: BLOCK, code: "const E = () => <button onClick={go} />", errors: [{ messageId: "native" }] },
      { filename: BLOCK, code: "const E = () => <input value={v} />", errors: [{ messageId: "native" }] },
      { filename: BLOCK, code: "const E = () => <select><option /></select>", errors: [{ messageId: "native" }] },
      { filename: BLOCK, code: "const E = () => <textarea />", errors: [{ messageId: "native" }] },
      { filename: "D:/repo/src/components/leaves/Toggle/index.tsx", code: "const E = () => <button />", errors: [{ messageId: "native" }] },
    ],
  })
})
