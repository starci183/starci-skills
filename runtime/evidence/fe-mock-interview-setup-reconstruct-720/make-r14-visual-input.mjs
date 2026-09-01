import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const base = path.dirname(fileURLToPath(import.meta.url))
const capture = JSON.parse(fs.readFileSync(path.join(base, "render-capture-r14.json"), "utf8"))
const captured = capture.output.result
const packet = {
  ...captured.blindReviewPacket,
  packetFingerprint: captured.blindReviewPacketFingerprint,
  captureReceiptId: "receipt:render-capture-r14",
}
const fingerprint = (value) => `sha256:${crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex")}`
const execution = (label) => `execution://${crypto.createHash("sha256").update(label).digest("hex")}`

const input = {
  schemaVersion: 7,
  operatorId: "fe/visual-fidelity",
  context: {
    implementerExecutionRef: execution("mock-interview-implementer-r14"),
    reviewerExecutionRef: execution("mock-interview-visual-reviewer-r14"),
    implementerPrincipalFingerprint: fingerprint("mock-interview-implementer-principal-r14"),
    reviewerPrincipalFingerprint: fingerprint("mock-interview-visual-reviewer-principal-r14"),
    reviewerContextFingerprint: fingerprint(packet),
    reviewerModel: "gpt-5.6-sol",
    reviewerCount: 1,
    contextIsolation: "fresh",
    forkTurns: "none",
    debug: true,
  },
  input: { blindReviewPacket: packet },
}

fs.writeFileSync(path.join(base, "visual-fidelity-input-r14.json"), JSON.stringify(input, null, 2) + "\n")
