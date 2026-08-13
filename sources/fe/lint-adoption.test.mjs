import assert from "node:assert/strict"
import test from "node:test"
import { auditLintAdoption } from "./lint-adoption.mjs"

const expected = {
  "starci-fe/contract-why-is-a-reason": "error",
  "starci-fe/no-children-slot": "error",
}

test("accepts only an effective config with every canonical rule strict and inline config disabled", () => {
  assert.deepEqual(
    auditLintAdoption(
      {
        rules: {
          "starci-fe/contract-why-is-a-reason": [2],
          "starci-fe/no-children-slot": "error",
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
        rules: { "starci-fe/contract-why-is-a-reason": "warn" },
        linterOptions: {},
      },
      expected,
    ),
    {
      ok: false,
      missing: ["starci-fe/no-children-slot"],
      nonError: ["starci-fe/contract-why-is-a-reason"],
      refusesInlineConfig: false,
    },
  )
})
