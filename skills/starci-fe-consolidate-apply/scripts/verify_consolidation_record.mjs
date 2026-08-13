/**
 * The Consolidate apply gate.
 *
 *   node verify_consolidation_record.mjs <consolidation-record.json> [--seal]
 *
 * WHY THIS EXISTS. This half makes one promise — ownership changes, the render does not — and the
 * promise fails in a way tests do not see. A merged owner with four callers updated and a fifth left
 * pointing at the deleted one compiles until it does not; a merge that quietly restyles one caller
 * passes every unit test it has, because no unit test knows what a screen looked like yesterday.
 *
 * So it checks two things nothing else can. First, that the work matches the survey it inherited:
 * the cluster set and the call-site set are the ones that were measured and approved, neither
 * widened while somebody was in the files nor narrowed because a caller turned out to be awkward.
 * Second, that every one of those call sites produced a same-state render on both sides.
 *
 * It does NOT re-judge the verdicts. Whether two owners are the same thing was settled and approved
 * in `starci-fe-consolidate-plan`, and re-deciding it here would put the judgement in two places.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"

const [, , recordArgument, mode] = process.argv

if (recordArgument === undefined) {
    console.error("Usage: node verify_consolidation_record.mjs <consolidation-record.json> [--seal]")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
if (!existsSync(recordPath)) {
    console.error(`Missing consolidation record: ${recordPath}`)
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

if (record.version !== 1) faults.push("Consolidation record version 1 is required")
require_(record.task, "task is required")
require_(record.contextLock, "contextLock is required")
require_(record.planRecord, "planRecord is required: Apply materializes an approved survey")

const boundary = record.writeBoundary
if (boundary?.confirmed !== true) faults.push("writeBoundary.confirmed must be true before any edit")
require_(boundary?.confirmationEvidence, "writeBoundary.confirmationEvidence must quote the user's confirmation")

/**
 * The inherited survey. Apply may implement fewer clusters than were approved - work can be split
 * across runs - but every cluster it does touch must be one the survey approved, with exactly the
 * call sites the survey measured.
 */
let approved = new Map()
if (record.planRecord !== undefined && record.planRecord !== null && record.planRecord !== "") {
    const planPath = isAbsolute(record.planRecord)
        ? record.planRecord
        : resolve(recordDirectory, record.planRecord)
    if (!existsSync(planPath)) faults.push(`planRecord points at a file that is not there: ${planPath}`)
    else {
        const plan = JSON.parse(readFileSync(planPath, "utf8"))
        if (plan.status !== "verdicts-approved") {
            faults.push("the inherited survey is not approved, so there is nothing to apply")
        }
        approved = new Map(
            (Array.isArray(plan.clusters) ? plan.clusters : []).map((cluster) => [cluster.clusterId, cluster]),
        )
    }
}

const clusters = Array.isArray(record.clusters) ? record.clusters : []
if (clusters.length === 0) faults.push("clusters must record at least one applied cluster")

const seen = new Set()
for (const cluster of clusters) {
    const label = cluster.clusterId ?? "<unnamed cluster>"
    require_(cluster.clusterId, "every cluster needs a clusterId")
    if (seen.has(cluster.clusterId)) faults.push(`Duplicate clusterId: ${cluster.clusterId}`)
    seen.add(cluster.clusterId)

    const source = approved.get(cluster.clusterId)
    if (source === undefined) {
        faults.push(`${label}: was never surveyed and approved, so Apply invented it`)
        continue
    }
    if (source.verdict === "keep-apart") {
        faults.push(`${label}: the survey kept this pair apart, and Apply edited it anyway`)
        continue
    }

    // Widening is scope creep discovered too late to review; narrowing is a caller left behind.
    const measured = Array.isArray(source.callSites) ? source.callSites : []
    const touched = Array.isArray(cluster.callSites) ? cluster.callSites : []
    const added = touched.filter((site) => !measured.includes(site))
    const dropped = measured.filter((site) => !touched.includes(site))
    if (added.length > 0) faults.push(`${label}: touches call sites the survey never measured: ${added.join(", ")}`)
    if (dropped.length > 0) faults.push(`${label}: leaves measured call sites behind: ${dropped.join(", ")}`)

    /**
     * The promise itself. Every measured call site shows what it rendered on both sides; a caller
     * with no evidence is exactly the caller that was forgotten.
     */
    const proven = new Map(
        (Array.isArray(cluster.parity) ? cluster.parity : []).map((entry) => [entry.callSite, entry]),
    )
    for (const callSite of measured) {
        const entry = proven.get(callSite)
        if (entry === undefined) {
            faults.push(`${label}: call site ${callSite} has no before/after render`)
            continue
        }
        require_(entry.stateId, `${label}: parity for ${callSite} needs a stateId`)
        for (const listSide of ["before", "after"]) {
            const hash = artifactHash(entry[listSide]?.path, `${label} ${callSite} ${listSide}`)
            if (hash === undefined) continue
            if (sealMode) entry[listSide].sha256 = hash
            else if (entry[listSide].sha256 !== hash) {
                faults.push(`${label}: ${callSite} ${listSide} render hash drift`)
            }
        }
        if (entry.identical !== true) {
            faults.push(
                `${label}: ${callSite} is not recorded as rendering identically, so ownership changed the screen`,
            )
        }
    }

    // A second word for the thing that now has one word.
    if (cluster.supersededRemoved !== true) {
        faults.push(`${label}: the superseded owner and its story must be removed in the same change`)
    }
}

if (faults.length > 0) {
    console.error(faults.map((fault) => `- ${fault}`).join("\n"))
    process.exit(1)
}

if (sealMode) writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
    ok: true,
    record: recordPath,
    planRecord: record.planRecord,
    clustersApplied: clusters.length,
    sealed: sealMode,
}, null, 2))
