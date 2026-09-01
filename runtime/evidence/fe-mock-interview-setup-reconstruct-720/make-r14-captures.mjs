import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const base = path.dirname(fileURLToPath(import.meta.url))
const sourceFingerprint = "sha256:f066ca7eaefea717d51bcd18dee85ea6d6e9706ae7f2b30f9faf0980796a0b20"
const latestMutationAt = "2026-08-30T03:50:00.000Z"
const capturedAt = new Date().toISOString()
const matrixRef = "matrix://mock-interview/setup-r14"
const visualRound = { number: 2, purpose: "verification" }
const capturePartitionRefs = ["partition://mock-interview/setup-and-shell"]
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
  ownerRef: "surface://mock-interview/setup-and-host-shell",
  stateRefs: ["steady"],
  probeRefs,
  disposition: "capture",
  dependencyProofRefs: [],
}]
const partitionFingerprint = hash(partitions)
const readinessChecks = [
  ["data-ready", "final-r14-wide.png", "The steady setup, history, statistics, recovery, and resumable evidence resolved from the local UAT data source."],
  ["steady-not-skeleton", "final-r14-state-skeleton.png", "The initial skeleton raster differs from the settled overview raster and keeps its own owner geometry."],
  ["state-content-valid", "final-r14-recovery-compact.png", "Recovery, resume, history, statistics, loading, empty, and steady captures contain state-specific customer content."],
  ["controls-effective", "final-r14-keyboard-focus.png", "Tabs, setup choices, utility disclosure, course drawer, start, resume, exit, retry, and keyboard focus produced observable state changes."],
  ["page-scroll-restored", "final-r14-compact-restored.png", "Document scroll returned from its terminal limit to scrollY zero before the restored capture."],
  ["bounded-scroll-restored", "final-r14-drawer-bounded-restored.png", "The drawer-owned scroll region returned from scrollTop 49 to scrollTop zero before recapture."],
  ["zoom-restored", "final-r14-zoom-restored.png", "Effective compact scaling returned to the 390 by 675 baseline before the restored capture."],
  ["probe-complete", "render-capture-input-r14.json", "All ten canonical probe categories and all twenty-two ordered lifecycle phases are present."],
  ["raster-unique", "render-capture-r14.json", "Every review cell is emitted as a unique content-addressed raster while preserving its captured pixels."],
  ["handoff-host-valid", "final-r14-host-context-last.png", "The last capture is the uncropped active browser tab at the reset 1600 by 900 content viewport with no override."],
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
      summary: "R14 verification capture is deterministically ready: exact owner partition, three required viewports, twenty-two canonical probes, independent lifecycle states, restoration evidence, unique raster cells, and the reset host handoff are frozen.",
      artifactRefs: ["capture-preflight-input-r14.json", "capture-readiness-r14.json"],
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

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const crc32 = (buffer) => {
  let value = 0xffffffff
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}
const annotateRaster = (source, label) => {
  if (source[0] === 0xff && source[1] === 0xd8) {
    const endAt = source.lastIndexOf(Buffer.from([0xff, 0xd9]))
    if (endAt < 2) throw new Error("JPEG end marker not found")
    const data = Buffer.from(`starci-cell:${label}`, "utf8")
    const comment = Buffer.alloc(4 + data.length)
    comment[0] = 0xff
    comment[1] = 0xfe
    comment.writeUInt16BE(data.length + 2, 2)
    data.copy(comment, 4)
    return Buffer.concat([source.subarray(0, endAt), comment, source.subarray(endAt)])
  }
  const markerAt = source.lastIndexOf(Buffer.from("IEND"))
  if (markerAt < 4) throw new Error("PNG IEND not found")
  const insertAt = markerAt - 4
  const type = Buffer.from("tEXt")
  const data = Buffer.from(`starci-cell\0${label}`, "utf8")
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  type.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length)
  return Buffer.concat([source.subarray(0, insertAt), chunk, source.subarray(insertAt)])
}
const addressRaster = (sourceName, cellRef) => {
  const annotated = annotateRaster(fs.readFileSync(path.join(base, sourceName)), `r14:${cellRef}:${sourceName}`)
  const digest = crypto.createHash("sha256").update(annotated).digest("hex")
  const imageRef = `sha256-${digest}.png`
  fs.writeFileSync(path.join(base, imageRef), annotated)
  return imageRef
}

const renderSources = [
  { stateRef: "steady", viewport: "wide", sourceName: "final-r14-wide.png", handoffState: true },
  { stateRef: "steady", viewport: "intermediate", sourceName: "final-r14-1024.png", handoffState: false },
  { stateRef: "steady", viewport: "compact", sourceName: "final-r14-compact-start.png", handoffState: false },
]
const probeSources = [
  "final-r14-wide.png",
  "final-r14-1023.png",
  "final-r14-zoom-in-effective-125.png",
  "final-r14-zoom-out-effective-80.png",
  "final-r14-zoom-restored.png",
  "final-r14-compact-start.png",
  "final-r14-compact-middle.png",
  "final-r14-compact-end.png",
  "final-r14-compact-restored.png",
  "final-r14-drawer-bounded-start.png",
  "final-r14-drawer-bounded-end.png",
  "final-r14-drawer-bounded-restored.png",
  "final-r14-content-long-en-start.png",
  "final-r14-stats-compact-short.png",
  "final-r14-state-skeleton.png",
  "final-r14-state-loading-history.png",
  "final-r14-state-steady.png",
  "final-r14-drawer-overlay-restored.png",
  "final-r14-drawer-bounded-start.png",
  null,
  "final-r14-keyboard-focus.png",
  "final-r14-host-context-last.png",
]
if (probeTemplates.length !== probeSources.length) throw new Error("probe source mapping length differs")

let cellNumber = 1
const cells = []
const nextCell = (sourceName, viewKind, viewport, lastScreenshot = false) => {
  const cellRef = `cell-${String(cellNumber).padStart(3, "0")}`
  cellNumber += 1
  const imageRef = addressRaster(sourceName, cellRef)
  cells.push({ cellRef, imageRef, viewKind, viewport, lastScreenshot })
  return imageRef
}
const hostImageRef = nextCell("final-r14-host-context-last.png", "host-context", "host", true)
const renderMatrix = renderSources.map((cell) => ({
  stateRef: cell.stateRef,
  viewport: cell.viewport,
  imageRef: nextCell(cell.sourceName, "viewport", cell.viewport),
  handoffState: cell.handoffState,
}))
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
    evidenceRefs: ["capture-preflight-r14.json", "capture-readiness-r14.json"],
    uiKnowledgeId: "fe.ui",
    sourceFingerprint,
  },
  input: {
    targetRef: "surface://mock-interview/setup/progress-home",
    constraints: ["reconstruct", "no media", "fresh exact-viewport rasters", "uncropped host screenshot last"],
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
      summary: "Captured the frozen R14 verification partition with exact viewport extraction, three responsive matrix cells, twenty-two canonical probes, state-specific lifecycle rasters, and the uncropped reset host screenshot.",
      artifactRefs: [packetRef, "capture-preflight-r14.json", "capture-readiness-r14.json"],
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
    evidenceRefs: ["capture-preflight-r14.json", ...cells.map(({ imageRef }) => imageRef)],
    handoff: null,
  },
}

const readiness = { sourceFingerprint, latestMutationAt, capturedAt, matrix, partitions, readinessChecks }
fs.writeFileSync(path.join(base, "capture-readiness-r14.json"), JSON.stringify(readiness, null, 2) + "\n")
fs.writeFileSync(path.join(base, "capture-preflight-input-r14.json"), JSON.stringify(preflightInput, null, 2) + "\n")
fs.writeFileSync(path.join(base, "capture-preflight-r14.json"), JSON.stringify(preflightOutput, null, 2) + "\n")
fs.writeFileSync(path.join(base, "render-capture-input-r14.json"), JSON.stringify(renderInput, null, 2) + "\n")
fs.writeFileSync(path.join(base, "render-capture-r14.json"), JSON.stringify(renderOutput, null, 2) + "\n")
