import assert from "node:assert/strict"
import test from "node:test"
import { auditLintAdoption } from "./lint-adoption.mjs"

const expected = {
  "starci-fe/no-inline-class-name": "error",
  "starci-fe/cn-arguments-are-single-tokens": "error",
}

test("accepts only an effective config with every canonical rule strict and inline config disabled", () => {
  assert.deepEqual(
    auditLintAdoption(
      {
        rules: {
          "starci-fe/no-inline-class-name": [2],
          "starci-fe/cn-arguments-are-single-tokens": "error",
        },
        linterOptions: { noInlineConfig: true },
      },
      expected,
    ),
    { ok: true, missing: [], nonError: [], refusesInlineConfig: true },
  )
})

test("names missing and weakened rules instead of accepting a plugin-shaped config", () => {
  assert.deepEqual(
    auditLintAdoption(
      {
        rules: { "starci-fe/no-inline-class-name": "warn" },
        linterOptions: {},
      },
      expected,
    ),
    {
      ok: false,
      missing: ["starci-fe/cn-arguments-are-single-tokens"],
      nonError: ["starci-fe/no-inline-class-name"],
      refusesInlineConfig: false,
    },
  )
})
