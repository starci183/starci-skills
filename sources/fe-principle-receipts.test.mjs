import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { hashCanonical, validatePrincipleReceipts } from "../scripts/validate-principle-receipts.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const proof = () => JSON.parse(readFileSync(join(ROOT, "fe/gates/proofs/course-content-principle-receipts.json"), "utf8"))
const rehash = (result) => ({
  ...result,
  principleReceiptHash: hashCanonical(result.principleReceipts),
  coverageHash: hashCanonical(result.coverage),
})

test("course content principle receipts bind every accepted decision to an exact recipe", () => {
  const result = proof()
  assert.equal(validatePrincipleReceipts(result, { trustRoot: ROOT }).decisionCount, 6)
})

for (const mutation of [
  {
    name: "module title cannot drift below text-base font-medium",
    decisionId: "course-map-module-title-typography",
    className: "text-sm font-semibold text-foreground",
  },
  {
    name: "lesson title cannot be promoted above text-base font-normal",
    decisionId: "course-map-lesson-title-typography",
    className: "text-sm font-medium text-foreground",
  },
  {
    name: "ordinary reader placement cannot invent mx-auto",
    decisionId: "content-reader-inner-margin",
    className: "mx-auto",
  },
  {
    name: "course overview remains a p-6 primary plane",
    decisionId: "course-content-overview-padding",
    className: "p-4",
  },
  {
    name: "content reader remains a p-6 primary plane",
    decisionId: "content-reader-inner-padding",
    className: "p-4",
  },
  {
    name: "course overview cannot invent mx-auto",
    decisionId: "course-content-overview-margin",
    className: "mx-auto",
  },
]) {
  test(mutation.name, () => {
    const result = proof()
    result.principleReceipts.find((receipt) => receipt.decisionId === mutation.decisionId).output.className = mutation.className
    assert.throws(() => validatePrincipleReceipts(rehash(result), { trustRoot: ROOT }), /className/)
  })
}

test("Execute cannot continue when one accepted decision has no principle receipt", () => {
  const result = proof()
  result.principleReceipts.pop()
  assert.throws(() => validatePrincipleReceipts(rehash(result), { trustRoot: ROOT }), /coverage mismatch/)
})
