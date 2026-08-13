/**
 * The Consolidate survey gate.
 *
 *   node verify_consolidation_plan.mjs <consolidation-plan.json>
 *
 * WHY THIS EXISTS. This half produces a proposal, and a proposal is judged on evidence somebody
 * else will act on without re-deriving it. Three of its judgements have a cheap wrong answer that
 * reads as progress: a variant prop per call site, an appearance slot handed to the caller, and a
 * new owner extracted from a coincidence that happened twice. Each of those looks like tidying and
 * each leaves the vocabulary worse than the duplication did.
 *
 * It deliberately checks no renders. Nothing has been applied yet, and demanding parity evidence
 * from a survey would push the survey into editing — which destroys the measurement the proposal
 * rests on. Parity belongs to `starci-fe-consolidate-apply`.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const [, , recordArgument] = process.argv

if (recordArgument === undefined) {
    console.error("Usage: node verify_consolidation_plan.mjs <consolidation-plan.json>")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
if (!existsSync(recordPath)) {
    console.error(`Missing consolidation plan: ${recordPath}`)
    process.exit(2)
}
const record = JSON.parse(readFileSync(recordPath, "utf8"))

const faults = []
const require_ = (value, message) => {
    if (value === undefined || value === null || value === "") faults.push(message)
}

const VERDICTS = ["merge", "prop-variant", "extract-composite", "keep-apart"]
const APPEARANCE = ["className", "class", "style", "sx", "css"]

if (record.version !== 1) faults.push("Consolidation plan version 1 is required")
require_(record.task, "task is required")
require_(record.contextLock, "contextLock is required")
require_(record.scope, "scope is required, and it is stated rather than assumed")

const clusters = Array.isArray(record.clusters) ? record.clusters : []
if (clusters.length === 0) faults.push("clusters must record at least one surveyed cluster")

const seen = new Set()
for (const cluster of clusters) {
    const label = cluster.clusterId ?? "<unnamed cluster>"
    require_(cluster.clusterId, "every cluster needs a clusterId")
    if (seen.has(cluster.clusterId)) faults.push(`Duplicate clusterId: ${cluster.clusterId}`)
    seen.add(cluster.clusterId)

    if (!VERDICTS.includes(cluster.verdict)) {
        faults.push(`${label}: verdict must be one of ${VERDICTS.join(", ")}`)
        continue
    }

    const members = Array.isArray(cluster.members) ? cluster.members : []
    if (members.length < 2) faults.push(`${label}: a cluster needs at least two members to compare`)

    // Measured against the tree as it stands. Apply inherits this list and may not widen it.
    const callSites = Array.isArray(cluster.callSites) ? cluster.callSites : []
    if (callSites.length === 0) faults.push(`${label}: callSites must be measured before any edit`)

    if (cluster.verdict === "keep-apart") {
        require_(cluster.reason, `${label}: keep-apart must record why these are two things`)
        continue
    }

    require_(cluster.canonicalTarget, `${label}: ${cluster.verdict} must name one canonical target`)

    const added = Array.isArray(cluster.propDelta?.added) ? cluster.propDelta.added : []
    if (cluster.verdict === "prop-variant") {
        if (added.length === 0) faults.push(`${label}: prop-variant must record the prop it adds`)
        if (added.length > 1) {
            faults.push(
                `${label}: prop-variant costs ${added.length} props, so these were two components and the survey found a coincidence`,
            )
        }
        for (const prop of added) {
            require_(prop.name, `${label}: every added prop needs a name`)
            require_(prop.absence, `${label}: ${prop.name ?? "<unnamed>"} must state its absence or default`)
        }
    }

    const offending = added.map((prop) => prop.name).filter((name) => APPEARANCE.includes(name))
    if (offending.length > 0) {
        faults.push(`${label}: hands the caller an appearance slot (${offending.join(", ")}), which SLOTS-6 refuses`)
    }

    // Two call sites is an anchor to two files. Three is a pattern, and only a pattern earns a new owner.
    if (cluster.verdict === "extract-composite" && callSites.length < 3) {
        faults.push(
            `${label}: extracting a new owner from ${callSites.length} call sites - two is an anchor, three is a pattern`,
        )
    }
}

/**
 * WHO APPROVED, AND WAS IT A CHOICE.
 *
 * A ranking is not an instruction. The common answer to "which of these should we consolidate?" is
 * "gộp hết đi" or nothing at all, and a survey with no rule for that hands the decision back to the
 * run. A default is allowed and is never recorded as approval - and here the safe default is to do
 * NOTHING, because a cluster left alone stays available and a wrong merge has to be unpicked from
 * every call site it touched.
 */
const acted = clusters.filter((cluster) => cluster.verdict !== "keep-apart")
if (record.status === "verdicts-approved") {
    if (!["explicit", "default-after-ambiguity"].includes(record.approvalKind)) {
        faults.push("approvalKind must be explicit or default-after-ambiguity")
    }
    if (record.approvalKind === "explicit") {
        require_(record.approvalEvidence, "an explicit approval must quote the user's words")
    }
    if (record.approvalKind === "default-after-ambiguity") {
        require_(record.defaultReason, "a default must record why the answer stayed ambiguous")
        if (acted.length > 0) {
            faults.push(
                `a default may only leave clusters alone, but ${acted.length} would be edited: ${acted.map((cluster) => cluster.clusterId).join(", ")}`,
            )
        }
    }
} else if (acted.length > 0 && record.status !== "verdicts-proposed") {
    faults.push("status must be verdicts-proposed or verdicts-approved")
}

if (faults.length > 0) {
    console.error(faults.map((fault) => `- ${fault}`).join("\n"))
    process.exit(1)
}
console.log(JSON.stringify({
    ok: true,
    plan: recordPath,
    clusters: clusters.length,
    toApply: acted.length,
    keptApart: clusters.length - acted.length,
}, null, 2))
