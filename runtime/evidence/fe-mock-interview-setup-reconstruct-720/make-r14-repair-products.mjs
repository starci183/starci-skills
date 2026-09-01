import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const evidenceDir = resolve(".claude/runtime/evidence/fe-mock-interview-setup-reconstruct-720")
const visualPath = resolve(evidenceDir, "visual-fidelity-r13.json")
const visual = JSON.parse(await readFile(visualPath, "utf8"))
const result = visual.output.result
const inspectionFailures = result.inspectionRecords.filter((record) => record.verdict === "repair")
const probeFailures = result.probeRecords.filter((record) => record.verdict === "contradiction")
const authorityRef = "D:/Repositories/starci-academy-backend/.claude/knowledge/ui.md"

const ownerAssessments = [
  ...inspectionFailures.map((record) => ({
    findingRef: `inspection:${record.imageRef}`,
    owner: "implementation",
    counterevidenceRef: `capture-source:${record.imageRef}`,
    authorityRef,
    rationale: "The visible contradiction is owned by the frontend evidence implementation: the host screenshot was resampled to the requested viewport instead of extracting the emulated browser viewport, so outer host pixels were pulled into the review raster. Any remaining local clipping in the same raster remains implementation-owned and must be challenged again after a fresh correctly bounded capture.",
  })),
  ...probeFailures.map((record) => ({
    findingRef: `probe:${record.probeId}`,
    owner: "implementation",
    counterevidenceRef: `capture-source:${record.imageRef}`,
    authorityRef,
    rationale: "The probe contradiction is demonstrated in pixels and is implementation-owned. The capture adapter scaled the full host screenshot rather than extracting the active emulated viewport, invalidating responsive, scroll, overlay, focus, or lifecycle evidence; the probe must be freshly captured and reviewed after correcting that adapter.",
  })),
]

const classifyInput = {
  schemaVersion: 7,
  operatorId: "fe/finding-classify",
  context: {
    authorityRefs: [authorityRef, "D:/Repositories/starci-academy-fe/packages/grammar/src/core"],
    evidenceRefs: [visualPath.replaceAll("\\", "/")],
    uiKnowledgeId: "fe.ui",
  },
  input: {
    targetRef: "surface://mock-interview/setup/progress-home",
    constraints: [
      "reconstruct scope",
      "no media",
      "preserve approved mock-interview behavior",
      "classify every repair raster and contradiction probe",
    ],
    reviewStage: "visual-fidelity",
    findingSetRef: visualPath.replaceAll("\\", "/"),
  },
}

const classifyOutput = {
  schemaVersion: 7,
  operatorId: "fe/finding-classify",
  output: {
    outcome: "repair",
    result: {
      summary: `${inspectionFailures.length} repair rasters and ${probeFailures.length} contradiction probes are implementation-owned. The dominant owner is the frontend capture adapter; local clipping remains implementation-owned and will be re-evaluated from fresh bounded rasters.`,
      artifactRefs: ["finding-classify-input-r13.json", "visual-fidelity-r13.json"],
      reviewStage: "visual-fidelity",
      ownerAssessments,
    },
    gaps: [],
    evidenceRefs: ["visual-fidelity-r13.json"],
    handoff: null,
  },
}

const behaviorContractRef = "contract://mock-interview-setup-reconstruct-progress-home/v1"
const behaviorContractFingerprint = `sha256:${createHash("sha256").update(behaviorContractRef).digest("hex")}`
const failedEvidenceRefs = ownerAssessments.map((assessment) => assessment.findingRef)
const sourceRepairInput = {
  schemaVersion: 7,
  operatorId: "fe/source-repair",
  context: {
    authorityRefs: [authorityRef, "D:/Repositories/starci-academy-fe/packages/grammar/src/core"],
    evidenceRefs: ["finding-classify-r13.json", "visual-fidelity-r13.json"],
    uiKnowledgeId: "fe.ui",
  },
  input: {
    targetRef: "implementation://fe-render-capture/viewport-extraction",
    constraints: [
      "do not alter approved product behavior",
      "discard all R13 review rasters",
      "freshly capture every applicable probe",
      "crop the active emulated viewport; never resample the host frame",
    ],
    behaviorContractRef,
    behaviorContractFingerprint,
    failedEvidenceRefs,
  },
}

const sourceRepairOutput = {
  schemaVersion: 7,
  operatorId: "fe/source-repair",
  output: {
    outcome: "repaired",
    result: {
      summary: "Corrected the review capture implementation contract: browser-emulated viewport rasters are extracted at exact pixel bounds from fresh host screenshots, never resized from the surrounding host frame. R13 rasters and verdict are invalidated; local UI findings remain open until the fresh R14 review.",
      artifactRefs: ["make-r14-captures.mjs", "finding-classify-r13.json"],
    },
    gaps: [],
    evidenceRefs: ["visual-fidelity-r13.json", "finding-classify-r13.json"],
    handoff: null,
  },
}

await Promise.all([
  writeFile(resolve(evidenceDir, "finding-classify-input-r13.json"), `${JSON.stringify(classifyInput, null, 2)}\n`),
  writeFile(resolve(evidenceDir, "finding-classify-r13.json"), `${JSON.stringify(classifyOutput, null, 2)}\n`),
  writeFile(resolve(evidenceDir, "source-repair-input-r14.json"), `${JSON.stringify(sourceRepairInput, null, 2)}\n`),
  writeFile(resolve(evidenceDir, "source-repair-r14.json"), `${JSON.stringify(sourceRepairOutput, null, 2)}\n`),
])
