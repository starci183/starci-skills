/**
 * The Plan gate.
 *
 *   node verify_plan_record.mjs <plan-record.json>
 *
 * WHY THIS EXISTS. Preview seals hashes and Apply proves same-state parity, so both phases fail
 * loudly when they drift. Plan had nothing: its output is a judgement about what the product should
 * be, graded by the same run that produced it, and a wrong direction chosen here survives every
 * later gate intact — Preview will faithfully build it and Apply will faithfully ship it. The most
 * consequential phase was the least checked one.
 *
 * What a machine CAN hold here is narrow, and this holds only that: the shape of the choice, and
 * the honesty of the record about who made it. Whether two directions are materially different is
 * a judgement no script can take; whether a direction claims to be implementable while naming
 * anatomy it cannot express is not a judgement at all, and neither is a selection that records no
 * evidence of anybody selecting.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const [, , recordArgument] = process.argv

if (recordArgument === undefined) {
    console.error("Usage: node verify_plan_record.mjs <plan-record.json>")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
if (!existsSync(recordPath)) {
    console.error(`Missing plan record: ${recordPath}`)
    process.exit(2)
}
const record = JSON.parse(readFileSync(recordPath, "utf8"))

const faults = []
const require_ = (value, message) => {
    if (value === undefined || value === null || value === "") faults.push(message)
}
const requireArray = (value, name) => {
    if (!Array.isArray(value)) faults.push(`${name} must be present as an array, even when empty`)
}

const POSTURES = ["parity-first", "conservative", "balanced", "bold"]

if (record.version !== 2) faults.push("Plan record version 2 is required")
require_(record.task, "task is required")
require_(record.contextLock, "contextLock is required")
require_(record.caseId, "caseId is required")

if (!["single", "batch"].includes(record.deliveryMode)) {
    faults.push("deliveryMode must be single or batch")
}
if (!["migration", "creative", "mixed"].includes(record.mode)) {
    faults.push("mode must be migration, creative or mixed")
}

// Plan HTML is a choice instrument. The field is invariant so that no run can quietly promote its
// own mockup into something a later phase may treat as a baseline.
if (record.renderStatus !== "directional-not-apply-baseline") {
    faults.push("renderStatus must be directional-not-apply-baseline")
}

for (const name of [
    "workItems", "evidence", "unknowns", "businessCapabilities", "stateManifest",
    "blockTrees", "contracts", "vocabularyProposals", "backendEnablerProposals",
]) {
    requireArray(record[name], name)
}

const directions = Array.isArray(record.directions) ? record.directions : []
if (directions.length < 2 || directions.length > 4) {
    faults.push(`two to four directions are required, found ${directions.length}`)
}

const directionIds = directions.map((direction) => direction.directionId)
const duplicate = directionIds.find((id, index) => directionIds.indexOf(id) !== index)
if (duplicate !== undefined) faults.push(`Duplicate directionId: ${duplicate}`)

for (const direction of directions) {
    const id = direction.directionId ?? "<unnamed>"
    require_(direction.directionId, "every direction needs a directionId")
    require_(direction.thesis, `${id}: thesis is required`)
    require_(direction.primaryCta, `${id}: primaryCta is required`)
    require_(direction.representativeSceneId, `${id}: representativeSceneId is required`)
    requireArray(direction.readingOrder, `${id}.readingOrder`)
    requireArray(direction.tradeoffs, `${id}.tradeoffs`)
    requireArray(direction.legacyDivergence, `${id}.legacyDivergence`)

    if (!POSTURES.includes(direction.posture)) {
        faults.push(`${id}: posture must be one of ${POSTURES.join(", ")}`)
    }

    const feasibility = direction.implementationFeasibility
    if (feasibility === undefined || feasibility === null) {
        faults.push(`${id}: implementationFeasibility is required`)
        continue
    }
    for (const name of ["existingOwners", "existingContracts", "exactProposals", "unmappedAnatomy"]) {
        requireArray(feasibility[name], `${id}.implementationFeasibility.${name}`)
    }
    // An attractive shape with no component path is research material, not a selectable option.
    const unmapped = Array.isArray(feasibility.unmappedAnatomy) ? feasibility.unmappedAnatomy : []
    if (feasibility.status === "mapped" && unmapped.length > 0) {
        faults.push(`${id}: claims mapped while naming unmapped anatomy: ${unmapped.join(", ")}`)
    }
}

// A migration has something to preserve, and a direction that preserves it. Without both, the
// difference between a port and a redesign cannot be reviewed, only asserted.
if (["migration", "mixed"].includes(record.mode)) {
    require_(record.parityBaseline, `${record.mode} mode requires a named parityBaseline`)
    if (!directions.some((direction) => direction.posture === "parity-first")) {
        faults.push(`${record.mode} mode requires one parity-first direction`)
    }
}

const lab = record.directionLab
if (lab === undefined || lab === null) faults.push("directionLab is required")
else {
    require_(lab.path, "directionLab.path is required")
    require_(lab.url, "directionLab.url is required")
    if (lab.caseId !== record.caseId) faults.push("directionLab.caseId must equal the record caseId")
    const missing = directionIds.filter((id) => !(lab.directionIds ?? []).includes(id))
    if (missing.length > 0) faults.push(`directions with no lab scene: ${missing.join(", ")}`)
}

/**
 * WHO CHOSE, AND WAS IT A CHOICE.
 *
 * The common answer to "which of these?" is not one of them. It is "either is fine", "whichever is
 * fastest", or silence, and a procedure with no rule for that leaves the run to invent one — which
 * is the exact failure the stop-for-selection step exists to prevent. So a default is permitted and
 * is never allowed to be recorded as a selection: it names its reason, and it may only fall to the
 * direction that risks least, which is the parity-first one where a baseline exists.
 */
const selected = record.selectedDirectionId
if (record.status === "direction-selected") {
    require_(selected, "status direction-selected requires selectedDirectionId")
} else if (selected !== undefined && selected !== null) {
    faults.push("selectedDirectionId is set while status is not direction-selected")
}

if (selected !== undefined && selected !== null && selected !== "") {
    if (!directionIds.includes(selected)) {
        faults.push(`selectedDirectionId ${selected} is not one of the recorded directions`)
    }
    if (!["explicit", "default-after-ambiguity"].includes(record.selectionKind)) {
        faults.push("selectionKind must be explicit or default-after-ambiguity")
    }
    if (record.selectionKind === "explicit") {
        require_(record.selectionEvidence, "an explicit selection must quote the user's words")
    }
    if (record.selectionKind === "default-after-ambiguity") {
        require_(record.defaultReason, "a default must record why the choice stayed ambiguous")
        const chosen = directions.find((direction) => direction.directionId === selected)
        const safest = record.parityBaseline ? "parity-first" : "conservative"
        if (chosen !== undefined && chosen.posture !== safest) {
            faults.push(
                `a default may only fall to the ${safest} direction, not to ${chosen.posture}`,
            )
        }
    }
}

if (faults.length > 0) {
    console.error(faults.map((fault) => `- ${fault}`).join("\n"))
    process.exit(1)
}
console.log(JSON.stringify({ ok: true, record: recordPath, caseId: record.caseId }, null, 2))
