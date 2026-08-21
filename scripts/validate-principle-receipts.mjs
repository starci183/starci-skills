import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const TRUST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export const hashCanonical = (value) => createHash("sha256").update(canonical(value)).digest("hex")

const plain = (value) => value
  .replaceAll("`", "")
  .replaceAll("*", "")
  .trim()

const rowFor = (markdown, code) => {
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
    if (plain(cells[0] ?? "") === code) return cells
  }
  return undefined
}

const allowedClassNames = (cell) => {
  const values = [...cell.matchAll(/`([^`]+)`/g)].map((match) => match[1])
  if (/\bno\b[^|]*\bclass\b/i.test(plain(cell))) values.unshift(null)
  if (values.length === 0) values.push(plain(cell))
  return values
}

const same = (left, right) => left === right

/** Validate exact coverage and recipes against the principle tables that own them. */
export const validatePrincipleReceipts = (result, options = {}) => {
  const trustRoot = options.trustRoot ?? TRUST_ROOT
  const receipts = result?.principleReceipts
  const coverage = result?.coverage
  if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("principleReceipts must be non-empty")
  if (!Array.isArray(coverage?.acceptedDecisionIds) || coverage.acceptedDecisionIds.length === 0) {
    throw new Error("coverage.acceptedDecisionIds must be non-empty")
  }
  if (!Array.isArray(coverage.uncoveredDecisionIds) || coverage.uncoveredDecisionIds.length !== 0) {
    throw new Error("coverage.uncoveredDecisionIds must be empty")
  }

  const accepted = new Set(coverage.acceptedDecisionIds)
  const received = new Set(receipts.map((receipt) => receipt.decisionId))
  if (received.size !== receipts.length) throw new Error("principle receipt decisionId values must be unique")
  const missing = [...accepted].filter((decisionId) => !received.has(decisionId))
  const unknown = [...received].filter((decisionId) => !accepted.has(decisionId))
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`principle receipt coverage mismatch: missing=${missing.join(",") || "none"}; unknown=${unknown.join(",") || "none"}`)
  }

  for (const receipt of receipts) {
    if (receipt.inputs === null || typeof receipt.inputs !== "object" || Object.keys(receipt.inputs).length < 2) {
      throw new Error(`${receipt.decisionId}: at least two classification inputs are required`)
    }
    if (!Array.isArray(receipt.evidenceRefs) || receipt.evidenceRefs.length === 0) {
      throw new Error(`${receipt.decisionId}: evidenceRefs must be non-empty`)
    }
    const source = `.claude/fe/gates/principles/${receipt.concern}/INDEX.md`
    if (receipt.source !== source) throw new Error(`${receipt.decisionId}: source must be ${source}`)
    const markdown = readFileSync(resolve(trustRoot, "fe", "gates", "principles", receipt.concern, "INDEX.md"), "utf8")
    const row = rowFor(markdown, receipt.code)
    if (row === undefined) throw new Error(`${receipt.decisionId}: ${receipt.code} is not defined by ${receipt.concern}`)

    const allowed = allowedClassNames(row.at(-1) ?? "")
    if (!allowed.some((value) => same(value, receipt.output?.className))) {
      throw new Error(`${receipt.decisionId}: className ${JSON.stringify(receipt.output?.className)} is not ${receipt.code}; expected ${allowed.map((value) => JSON.stringify(value)).join(" or ")}`)
    }
    if (receipt.concern === "typography") {
      const element = plain(row.at(-2) ?? "")
      if (receipt.output?.element !== element) {
        throw new Error(`${receipt.decisionId}: element ${JSON.stringify(receipt.output?.element)} is not ${receipt.code}; expected ${JSON.stringify(element)}`)
      }
    } else if (receipt.output?.element !== null) {
      throw new Error(`${receipt.decisionId}: non-typography receipts must emit element=null`)
    }
  }

  const principleReceiptHash = hashCanonical(receipts)
  const coverageHash = hashCanonical(coverage)
  if (result.principleReceiptHash !== principleReceiptHash) throw new Error("principleReceiptHash does not match canonical receipts")
  if (result.coverageHash !== coverageHash) throw new Error("coverageHash does not match canonical coverage")
  return { coverageHash, decisionCount: receipts.length, principleReceiptHash }
}

const receiptArg = process.argv.indexOf("--receipt")
if (receiptArg >= 0) {
  const path = process.argv[receiptArg + 1]
  if (path === undefined) throw new Error("--receipt requires a JSON path")
  const result = JSON.parse(readFileSync(resolve(path), "utf8"))
  process.stdout.write(`${JSON.stringify(validatePrincipleReceipts(result))}\n`)
}
