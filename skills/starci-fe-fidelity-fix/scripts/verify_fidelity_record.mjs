/**
 * The Fidelity gate.
 *
 *   node verify_fidelity_record.mjs <fidelity-record.json>
 *
 * WHY THIS EXISTS. Every other phase records its work in a schema something checks. This one
 * recorded its work in prose, and it is the phase most likely to be run in a hurry — "just make
 * this match" — by someone who already believes they know the answer.
 *
 * Its central discipline is a single sentence: the before and the after must be the SAME state.
 * That sentence is also the easiest one in the tree to break without noticing, because the two
 * screenshots look comparable either way. An owner render against a visitor render, a seeded list
 * against an empty one, light against dark: each of those produces a convincing pair that proves
 * nothing, and the run reports a fixed defect that was never measured.
 *
 * So this checks the one thing prose cannot enforce and a reviewer cannot see: that both sides of
 * every comparison declare identical route, viewport, locale, theme, persona, fixture and owner
 * state, and differ only in the commit they were taken at.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"

const [, , recordArgument, mode] = process.argv

if (recordArgument === undefined) {
    console.error("Usage: node verify_fidelity_record.mjs <fidelity-record.json> [--seal]")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
if (!existsSync(recordPath)) {
    console.error(`Missing fidelity record: ${recordPath}`)
    process.exit(2)
}
const record = JSON.parse(readFileSync(recordPath, "utf8"))
const recordDirectory = dirname(recordPath)
const sealMode = mode === "--seal"

const faults = []
const require_ = (value, message) => {
    if (value === undefined || value === null || value === "") faults.push(message)
}

const artifactHash = (path, label) => {
    if (path === undefined || path === null || path === "") {
        faults.push(`${label} names no file`)
        return undefined
    }
    const absolute = isAbsolute(path) ? path : resolve(recordDirectory, path)
    if (!existsSync(absolute)) {
        faults.push(`${label} points at a file that is not there: ${absolute}`)
        return undefined
    }
    return createHash("sha256").update(readFileSync(absolute)).digest("hex")
}

const BINDING_KINDS = ["instruction", "legacy-source", "approved-revision", "contract-why", "test"]

/** The fields both sides of a comparison must agree on. `commit` is deliberately absent: it is the one that may differ. */
const IDENTITY = ["route", "locale", "theme", "authPersona", "ownerState", "fixtureSha256"]

if (record.version !== 1) faults.push("Fidelity record version 1 is required")
require_(record.task, "task is required")
require_(record.contextLock, "contextLock is required")

// One defect, one owner. Ownership expansion is a product decision, and this lane has none.
require_(record.owner, "owner is required, and it is exactly one owner")
if (!Array.isArray(record.files) || record.files.length === 0) {
    faults.push("files must name the exact writable files")
}

/**
 * The expected result must already exist somewhere outside this run. A fix whose only evidence is
 * the run's own judgement is a design decision wearing a repair's clothes, and it belongs to Plan.
 */
const binding = record.bindingEvidence
if (binding === undefined || binding === null) faults.push("bindingEvidence is required")
else {
    if (!BINDING_KINDS.includes(binding.kind)) {
        faults.push(`bindingEvidence.kind must be one of ${BINDING_KINDS.join(", ")}`)
    }
    require_(binding.source, "bindingEvidence.source must name where the expected result is proven")
}

// A small fix changes the amount of code, not the authority required to change it.
const boundary = record.writeBoundary
if (boundary?.confirmed !== true) faults.push("writeBoundary.confirmed must be true before any edit")
require_(boundary?.confirmationEvidence, "writeBoundary.confirmationEvidence must quote the user's confirmation")

const states = Array.isArray(record.touchedStates) ? record.touchedStates : []
if (states.length === 0) faults.push("touchedStates must record at least one measured state")

const seen = new Set()
for (const state of states) {
    const label = state.stateId ?? "<unnamed state>"
    require_(state.stateId, "every touched state needs a stateId")
    if (seen.has(state.stateId)) faults.push(`Duplicate stateId: ${state.stateId}`)
    seen.add(state.stateId)

    if (state.ownerId !== record.owner) {
        faults.push(`${label} belongs to ${state.ownerId ?? "<no owner>"}, not to the frozen owner ${record.owner}`)
    }

    for (const side of ["before", "after"]) {
        const evidence = state[side]
        if (evidence === undefined || evidence === null) {
            faults.push(`${label} has no ${side} evidence`)
            continue
        }
        require_(evidence.commit, `${label}.${side}.commit is required`)
        for (const field of IDENTITY) {
            require_(evidence[field], `${label}.${side}.${field} is required`)
        }
        for (const field of ["width", "height", "dpr"]) {
            require_(evidence.viewport?.[field], `${label}.${side}.viewport.${field} is required`)
        }
        const hash = artifactHash(evidence.render?.path, `${label}.${side}.render`)
        if (hash === undefined) continue
        if (sealMode) evidence.render.sha256 = hash
        else if (evidence.render.sha256 !== hash) faults.push(`${label}.${side} render hash drift`)
    }

    // The rule the whole lane rests on.
    const before = state.before
    const after = state.after
    if (before === undefined || after === undefined) continue
    const differing = IDENTITY.filter((field) => before[field] !== after[field])
    for (const field of ["width", "height", "dpr"]) {
        if (before.viewport?.[field] !== after.viewport?.[field]) differing.push(`viewport.${field}`)
    }
    if (differing.length > 0) {
        faults.push(
            `${label} compares two different states, so the comparison is invalid rather than failed: `
            + differing.map((field) => `${field} ${before[field] ?? before.viewport?.[field.split(".")[1]]} vs ${after[field] ?? after.viewport?.[field.split(".")[1]]}`).join(", "),
        )
    }
}

if (faults.length > 0) {
    console.error(faults.map((fault) => `- ${fault}`).join("\n"))
    process.exit(1)
}

if (sealMode) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
}
console.log(JSON.stringify({
    ok: true,
    record: recordPath,
    owner: record.owner,
    states: states.length,
    sealed: sealMode,
}, null, 2))
