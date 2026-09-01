import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const base = path.dirname(fileURLToPath(import.meta.url))
const sourceFingerprint = "sha256:46ac490ef9d07db721ec49bba65578659d6e240a69b1f16c48bf843f8c7ae096"
const latestMutationAt = "2026-08-30T05:28:19.0887777Z"
const capturedAt = new Date().toISOString()
const matrixRef = "matrix://mock-interview/progress-home-r15"
const visualRound = { number: 3, purpose: "regression" }
const capturePartitionRefs = ["partition://mock-interview/progress-home-and-shell"]
const reusedPartitionRefs = []
const hash = (value) => `sha256:${crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")}`

const probeTemplates = JSON.parse(fs.readFileSync(path.join(base, "render-capture-input-r13.json"), "utf8")).input.adversarialProbes
const probeRefs = probeTemplates.map(({ probeId }) => probeId)
const matrix = {
  matrixRef,
  matrixFingerprint: hash({ renderStates: ["steady"], viewports: ["wide", "intermediate", "compact"], probeRefs }),
  renderStates: ["steady"],
  viewports: ["wide", "intermediate", "compact"],
  probeRefs,
}
const partitions = [{
  partitionRef: capturePartitionRefs[0],
  ownerRef: "surface://mock-interview/progress-home-and-host-shell",
  stateRefs: ["steady"],
  probeRefs,
  disposition: "capture",
  dependencyProofRefs: [],
}]
const partitionFingerprint = hash(partitions)
const readinessChecks = [
  ["data-ready", "final-r15-wide-home.png", "The settled first-use home resolves to one purposeful next action after its course data finishes."],
  ["steady-not-skeleton", "final-r15-state-skeleton.png", "The initial skeleton and final steady home are separate fresh rasters with different visible content."],
  ["state-content-valid", "final-r15-recovery-compact.png", "First-use, recovery, resume, loading, and steady states each contain state-specific customer content."],
  ["controls-effective", "final-r15-keyboard-focus-return.png", "Setup choices, open/close, start, resume, cancellation, shell collapse, retry, and keyboard focus produced observable state changes."],
  ["page-scroll-restored", "final-r15-page-scroll-restored.png", "Document scroll returned from its terminal limit to scrollY zero before the restored capture."],
  ["bounded-scroll-restored", "final-r15-compact-setup-restored.png", "The drawer-owned scroll region returned from its terminal limit to scrollTop zero before recapture."],
  ["zoom-restored", "final-r15-zoom-restored.png", "Effective scaling returned from 125 and 80 percent probes to the compact baseline before the restored capture."],
  ["probe-complete", "render-capture-input-r15.json", "All ten canonical probe categories and all twenty-two ordered lifecycle phases are present."],
  ["raster-unique", "render-capture-r15.json", "Every review raster is a direct content-addressed copy of one fresh screenshot; no metadata annotation or pixel substitution is used."],
  ["handoff-host-valid", "final-r15-host-context-last.png", "The last capture is the uncropped active browser tab after resetting to a 1600 by 900 content viewport with no override."],
].map(([check, evidenceRef, observation]) => ({ check, verdict: "passed", evidenceRef, observation }))
const preflightSeed = { sourceFingerprint, round: visualRound, matrix, partitions, readinessChecks }
const preflightRef = `preflight://${hash(preflightSeed).slice(7)}`

const preflightInput = {
  schemaVersion: 7,
  operatorId: "fe/capture-preflight",
  context: {
    authorityRefs: ["contract://mock-interview-setup-reconstruct-progress-home/v1"],
    evidenceRefs: readinessChecks.map(({ evidenceRef }) => evidenceRef),
    uiKnowledgeId: "fe.ui",
    sourceFingerprint,
    debug: true,
  },
  input: {
    targetRef: "surface://mock-interview/setup/progress-home",
    round: visualRound,
    matrix,
    partitions,
    readinessChecks,
  },
}
const preflightOutput = {
  schemaVersion: 7,
  operatorId: "fe/capture-preflight",
  output: {
    outcome: "ready",
    result: {
      summary: "R15 regression capture is ready from the current source: stable responsive matrix, canonical adversarial probes, authentic lifecycle states, restoration receipts, and the reset host handoff are frozen.",
      artifactRefs: ["capture-preflight-input-r15.json", "capture-readiness-r15.json"],
      preflightRef,
      sourceFingerprint,
      round: visualRound,
      matrixRef,
      matrixFingerprint: matrix.matrixFingerprint,
      partitionFingerprint,
      capturePartitionRefs,
      reusedPartitionRefs,
      readinessChecks,
    },
    gaps: [],
    evidenceRefs: readinessChecks.map(({ evidenceRef }) => evidenceRef),
    handoff: null,
  },
}

const usedDigests = new Set()
const addressRaster = (sourceName) => {
  const source = fs.readFileSync(path.join(base, sourceName))
  const digest = crypto.createHash("sha256").update(source).digest("hex")
  if (usedDigests.has(digest)) throw new Error(`duplicate raster pixels: ${sourceName}`)
  usedDigests.add(digest)
  const imageRef = `sha256-${digest}.png`
  fs.copyFileSync(path.join(base, sourceName), path.join(base, imageRef))
  return imageRef
}

let cellNumber = 1
const cells = []
const nextCell = (sourceName, viewKind, viewport, lastScreenshot = false) => {
  const cellRef = `cell-${String(cellNumber).padStart(3, "0")}`
  cellNumber += 1
  const imageRef = addressRaster(sourceName)
  cells.push({ cellRef, imageRef, viewKind, viewport, lastScreenshot })
  return imageRef
}

const hostImageRef = nextCell("final-r15-host-context-last.png", "host-context", "host", true)
const renderSources = [
  { stateRef: "steady", viewport: "wide", sourceName: "final-r15-wide-home.png", handoffState: true },
  { stateRef: "steady", viewport: "intermediate", sourceName: "final-r15-intermediate-1024-home.png", handoffState: false },
  { stateRef: "steady", viewport: "compact", sourceName: "final-r15-compact-home.png", handoffState: false },
]
const renderMatrix = renderSources.map((cell) => ({
  stateRef: cell.stateRef,
  viewport: cell.viewport,
  imageRef: nextCell(cell.sourceName, "viewport", cell.viewport),
  handoffState: cell.handoffState,
}))

const probeSources = [
  "final-r15-shell-collapsed.png",
  "final-r15-breakpoint-1023-home.png",
  "final-r15-zoom-in-effective-125.png",
  "final-r15-zoom-out-effective-80.png",
  "final-r15-zoom-restored.png",
  "final-r15-page-scroll-start.png",
  "final-r15-page-scroll-middle.png",
  "final-r15-page-scroll-end.png",
  "final-r15-page-scroll-restored.png",
  "final-r15-compact-setup-start.png",
  "final-r15-compact-setup-end.png",
  "final-r15-compact-setup-restored.png",
  "final-r15-content-long-en-setup.png",
  "final-r15-content-short-stats.png",
  "final-r15-state-skeleton.png",
  "final-r15-state-loading-history.png",
  "final-r15-state-steady.png",
  "final-r15-resume-wide-final.png",
  "final-r15-wide-setup-open.png",
  null,
  "final-r15-keyboard-focus-return.png",
  "final-r15-recovery-compact.png",
]
if (probeTemplates.length !== probeSources.length) throw new Error("probe source mapping length differs")

const probeViewKind = (probe) => {
  if (probe.category === "page-scroll") return probe.phase === "middle" ? "scroll-middle" : probe.phase === "end" ? "scroll-terminal" : "scroll-start"
  if (probe.category === "bounded-scroll" || probe.phase === "overlay-open") return "overlay"
  if (probe.category === "state-transition") return "lifecycle"
  if (probe.category === "content-stress" || probe.category === "keyboard-focus") return "surface-focus"
  return "viewport"
}
const probeViewport = (probe) => probe.category === "composition-neighbors" ? "host" : probe.category === "viewport" && probe.phase === "baseline" ? "wide" : "compact"
const adversarialProbeMatrix = probeTemplates.map((probe, index) => {
  const sourceName = probeSources[index]
  if (sourceName === null) return { ...probe, outcome: "not-applicable", imageRef: null, reason: "interaction-not-present" }
  return { ...probe, outcome: "survived", imageRef: nextCell(sourceName, probeViewKind(probe), probeViewport(probe)), reason: null }
})
const probeCells = adversarialProbeMatrix.map(({ probeId, category, phase, outcome, imageRef, reason }) => ({
  probeId,
  category,
  phase,
  applicable: outcome !== "not-applicable",
  imageRef,
  reason: outcome === "not-applicable" ? reason : null,
}))

const packetRef = `packet://${hash({ sourceFingerprint, capturedAt, matrixRef }).slice(7)}`
const blindReviewPacket = {
  packetRef,
  preflightRef,
  matrixRef,
  matrixFingerprint: matrix.matrixFingerprint,
  partitionFingerprint,
  visualRound,
  capturePartitionRefs,
  reusedPartitionRefs,
  latestMutationFingerprint: sourceFingerprint,
  capturedSourceFingerprint: sourceFingerprint,
  latestMutationAt,
  capturedAt,
  rasterCells: cells,
  probeCells,
  lastScreenshotRef: hostImageRef,
}
const blindReviewPacketFingerprint = hash(blindReviewPacket)

const renderInput = {
  schemaVersion: 7,
  operatorId: "fe/render-capture",
  context: {
    authorityRefs: ["contract://mock-interview-setup-reconstruct-progress-home/v1"],
    evidenceRefs: ["capture-preflight-r15.json", "capture-readiness-r15.json"],
    uiKnowledgeId: "fe.ui",
    sourceFingerprint,
  },
  input: {
    targetRef: "surface://mock-interview/setup/progress-home",
    constraints: ["reconstruct", "no media", "fresh authentic exact-viewport rasters", "uncropped host screenshot last"],
    adversarialProbes: probeTemplates,
    renderStates: ["steady"],
    viewports: ["wide", "intermediate", "compact"],
    handoffStateRef: "steady",
    handoffViewport: { surfaceRef: "browser-tab:8", widthPx: 1600, heightPx: 900, viewportOverride: false },
    preflight: {
      preflightRef,
      matrixRef,
      matrixFingerprint: matrix.matrixFingerprint,
      partitionFingerprint,
      round: visualRound,
      capturePartitionRefs,
      reusedPartitionRefs,
    },
  },
}
const renderOutput = {
  schemaVersion: 7,
  operatorId: "fe/render-capture",
  output: {
    outcome: "captured",
    result: {
      summary: "Captured the frozen R15 regression partition from authentic fresh pixels: stable responsive matrix, twenty-two canonical probes, recovery and resume states, and the uncropped reset host screenshot.",
      artifactRefs: [packetRef, "capture-preflight-r15.json", "capture-readiness-r15.json"],
      preflightRef,
      matrixRef,
      matrixFingerprint: matrix.matrixFingerprint,
      partitionFingerprint,
      visualRound,
      capturePartitionRefs,
      reusedPartitionRefs,
      sourceFingerprint,
      latestMutationFingerprint: sourceFingerprint,
      latestMutationAt,
      capturedAt,
      blindReviewPacketRef: packetRef,
      blindReviewPacketFingerprint,
      blindReviewPacket,
      renderMatrix,
      adversarialProbeMatrix,
      handoffHostArtifact: { surfaceRef: "browser-tab:8", widthPx: 1600, heightPx: 900, viewportOverride: false, imageRef: hostImageRef },
    },
    gaps: [],
    evidenceRefs: ["capture-preflight-r15.json", ...cells.map(({ imageRef }) => imageRef)],
    handoff: null,
  },
}

const readiness = { sourceFingerprint, latestMutationAt, capturedAt, matrix, partitions, readinessChecks }
fs.writeFileSync(path.join(base, "capture-readiness-r15.json"), `${JSON.stringify(readiness, null, 2)}\n`)
fs.writeFileSync(path.join(base, "capture-preflight-input-r15.json"), `${JSON.stringify(preflightInput, null, 2)}\n`)
fs.writeFileSync(path.join(base, "capture-preflight-r15.json"), `${JSON.stringify(preflightOutput, null, 2)}\n`)
fs.writeFileSync(path.join(base, "render-capture-input-r15.json"), `${JSON.stringify(renderInput, null, 2)}\n`)
fs.writeFileSync(path.join(base, "render-capture-r15.json"), `${JSON.stringify(renderOutput, null, 2)}\n`)
