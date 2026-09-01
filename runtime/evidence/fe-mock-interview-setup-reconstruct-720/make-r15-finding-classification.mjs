import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const base = path.dirname(fileURLToPath(import.meta.url))
const visualName = "visual-fidelity-r15.json"
const visual = JSON.parse(fs.readFileSync(path.join(base, visualName), "utf8"))
const result = visual.output.result
const partitionRef = "partition://mock-interview/progress-home-and-shell"
const uiAuthority = "D:/Repositories/starci-academy-backend/.claude/knowledge/ui.md"
const grammarAuthority = "D:/Repositories/starci-academy-fe/packages/grammar/src/core"
const hash = (value) => `sha256:${crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")}`

const rasterFindings = result.inspectionRecords
  .filter((record) => record.verdict === "repair")
  .map((record) => ({
    findingRef: `inspection:${record.imageRef}`,
    observation: record.lensVerdicts.filter((lens) => lens.verdict === "problem").map((lens) => lens.observation).join(" "),
    counterevidenceRef: record.imageRef,
  }))
const probeFindings = result.probeRecords
  .filter((record) => record.verdict === "contradiction")
  .map((record) => ({
    findingRef: `probe:${record.probeId}`,
    observation: record.observation,
    counterevidenceRef: record.imageRef,
  }))
const findings = [...rasterFindings, ...probeFindings]
const findingLedger = findings.map((finding) => ({
  findingRef: finding.findingRef,
  findingFingerprint: hash({ findingRef: finding.findingRef, observation: finding.observation }),
  disposition: "new",
  affectedPartitionRefs: [partitionRef],
}))
const ownerAssessments = findings.map((finding) => ({
  findingRef: finding.findingRef,
  owner: "implementation",
  counterevidenceRef: finding.counterevidenceRef,
  authorityRef: uiAuthority,
  rationale: finding.findingRef.includes("page-scroll") || finding.findingRef.includes("bounded-scroll") || finding.observation.includes("cut") || finding.observation.includes("clip")
    ? "The visible content collision violates the approved pinned-boundary and readable-continuation UI rules; the owner is the frontend layout implementation."
    : "The review raster or probe metadata changes viewport, owner, or lifecycle state instead of isolating the requested attack; the owner is the frontend capture implementation, not product authority.",
}))
const batchRef = `batch://${hash(findingLedger).slice(7)}`
const visualRound = { number: 3, purpose: "regression" }
const input = {
  schemaVersion: 7,
  operatorId: "fe/finding-classify",
  context: {
    authorityRefs: [uiAuthority, grammarAuthority, "contract://mock-interview-setup-reconstruct-progress-home/v1"],
    evidenceRefs: [visualName, "render-capture-r15.json"],
    uiKnowledgeId: "fe.ui",
  },
  input: {
    targetRef: "surface://mock-interview/setup/progress-home",
    constraints: ["reconstruct", "round-3 terminal semantics", "classify the complete finding batch", "do not repair"],
    reviewStage: "visual-fidelity",
    findingSetRef: visualName,
    visualRound,
    findingRefs: findings.map(({ findingRef }) => findingRef),
  },
}
const output = {
  schemaVersion: 7,
  operatorId: "fe/finding-classify",
  output: {
    outcome: "blocked",
    result: {
      summary: `${rasterFindings.length} raster repairs and ${probeFindings.length} probe contradictions are implementation-owned. Three visible scroll collisions belong to the product layout; the remaining contradictions belong to capture comparability. Round 3 is terminal, so no fourth repair loop is authorized.`,
      artifactRefs: ["finding-classify-input-r15.json", visualName, "render-capture-r15.json"],
      reviewStage: "visual-fidelity",
      batchRef,
      visualRound,
      findingLedger,
      ownerAssessments,
    },
    gaps: ["Round 3 regression contains visible findings and therefore cannot route to source repair, quality assurance, or UAT."],
    evidenceRefs: [visualName, "render-capture-r15.json", "final-r15-page-scroll-middle.png", "final-r15-page-scroll-end.png", "final-r15-compact-setup-end.png"],
    handoff: null,
  },
}

fs.writeFileSync(path.join(base, "finding-classify-input-r15.json"), `${JSON.stringify(input, null, 2)}\n`)
fs.writeFileSync(path.join(base, "finding-classify-r15.json"), `${JSON.stringify(output, null, 2)}\n`)
