import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"

const [, , recordArgument, mode] = process.argv

if (recordArgument === undefined) {
    console.error("Usage: node verify_design_record.mjs <design-record.json> [--seal]")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
const recordDirectory = dirname(recordPath)
const record = JSON.parse(readFileSync(recordPath, "utf8"))

const fail = (message) => {
    console.error(message)
    process.exit(1)
}

const requireValue = (value, message) => {
    if (value === undefined || value === null || value === "") fail(message)
}

const absoluteArtifactPath = (candidatePath) => {
    requireValue(candidatePath, "Artifact path is required")
    return isAbsolute(candidatePath) ? candidatePath : resolve(recordDirectory, candidatePath)
}

const fileHash = (candidatePath) => {
    const artifactPath = absoluteArtifactPath(candidatePath)
    if (!existsSync(artifactPath)) fail(`Missing sealed artifact: ${artifactPath}`)
    return createHash("sha256").update(readFileSync(artifactPath)).digest("hex")
}

const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable)
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    }
    return value
}

if (record.version !== 3) fail("Executable design record version 3 is required")
requireValue(record.caseId, "caseId is required")
requireValue(record.approvedRevision, "approvedRevision is required")
requireValue(record.approval?.source, "Explicit approval evidence is required")
requireValue(record.candidate?.root, "candidate.root is required")
requireValue(record.candidate?.framework, "candidate.framework is required")
requireValue(record.candidate?.buildCommand, "candidate.buildCommand is required")

const candidateRoot = absoluteArtifactPath(record.candidate.root)
if (!existsSync(candidateRoot)) fail(`Missing candidate root: ${candidateRoot}`)

if (!Array.isArray(record.candidate?.files) || record.candidate.files.length === 0) {
    fail("At least one candidate file is required")
}
if (!Array.isArray(record.states) || record.states.length === 0) fail("At least one state is required")

const duplicate = (values) => values.find((value, index) => values.indexOf(value) !== index)
const duplicateTarget = duplicate(record.candidate.files.map((candidateFile) => candidateFile.targetPath))
if (duplicateTarget !== undefined) fail(`Duplicate candidate targetPath: ${duplicateTarget}`)
const duplicateState = duplicate(record.states.map((state) => state.stateId))
if (duplicateState !== undefined) fail(`Duplicate stateId: ${duplicateState}`)

const sealMode = mode === "--seal"

/**
 * Why targetPath is checked as strictly as the candidate path.
 *
 * `candidate.path` says which artifact file was approved; `targetPath` says where Apply will WRITE
 * it. Only the second one leaves the artifact root, which makes it the more dangerous of the two: a
 * sealed record carrying an absolute or climbing targetPath asks a confirmed write boundary to
 * accept a file outside itself, and the seal makes that request look reviewed. A target is a path
 * relative to the repository Apply confirmed, and nothing else.
 */
const targetPathFault = (targetPath) => {
    if (isAbsolute(targetPath)) return "is absolute"
    if (/^[a-zA-Z]:[\\/]/.test(targetPath)) return "names a drive"
    if (/^[\\/]/.test(targetPath)) return "is rooted"
    if (targetPath.split(/[\\/]+/).includes("..")) return "climbs above the target repository"
    return undefined
}

for (const candidateFile of record.candidate.files) {
    requireValue(candidateFile.targetPath, "Every candidate file needs targetPath")
    const fault = targetPathFault(candidateFile.targetPath)
    if (fault !== undefined) fail(`Candidate targetPath ${fault}: ${candidateFile.targetPath}`)
    const artifactPath = absoluteArtifactPath(candidateFile.path)
    const pathFromCandidateRoot = relative(candidateRoot, artifactPath)
    if (pathFromCandidateRoot.startsWith("..") || isAbsolute(pathFromCandidateRoot)) {
        fail(`Candidate file escapes candidate.root: ${candidateFile.path}`)
    }
    const actual = fileHash(candidateFile.path)
    if (sealMode) candidateFile.sha256 = actual
    else if (candidateFile.sha256 !== actual) fail(`Candidate hash drift: ${candidateFile.path}`)
}

for (const state of record.states) {
    for (const key of ["stateId", "ownerId", "route", "locale", "theme", "authPersona"]) {
        requireValue(state[key], `State ${state.stateId ?? "<unknown>"} is missing ${key}`)
    }
    if (state.coverage !== "rendered") fail(`State ${state.stateId} must declare coverage: rendered`)
    for (const key of ["width", "height", "dpr"]) {
        requireValue(state.viewport?.[key], `State ${state.stateId} is missing viewport.${key}`)
    }
    for (const artifactName of ["fixture", "screenshot"]) {
        const artifact = state[artifactName]
        const actual = fileHash(artifact?.path)
        if (sealMode) artifact.sha256 = actual
        else if (artifact.sha256 !== actual) fail(`${artifactName} hash drift: ${artifact.path}`)
    }
    for (const key of ["componentTree", "contracts", "props", "tokens"]) {
        if (!Array.isArray(state[key])) fail(`State ${state.stateId} needs array ${key}`)
    }
}

/**
 * Why the build is an artifact and not a sentence.
 *
 * `buildCommand` used to be satisfied by any non-empty string, so a record could name the command
 * it would have run and seal as though it had. The whole claim of this phase is that the approved
 * thing EXECUTES — that is the line between a candidate and a picture — and it was the one claim
 * the verifier took on trust. A hashed log makes running it the cheapest way to satisfy it.
 */
const build = record.candidate.build
requireValue(build?.command, "candidate.build.command is required")
if (build?.exitCode !== 0) {
    fail(`Candidate build did not pass: exitCode ${build?.exitCode ?? "<absent>"}`)
}
const buildLogHash = fileHash(build.log?.path)
if (sealMode) build.log.sha256 = buildLogHash
else if (build.log.sha256 !== buildLogHash) fail(`build log hash drift: ${build.log.path}`)

/**
 * Why a passing BUILD was never enough.
 *
 * A build proves the candidate executes. It does not prove the candidate is StarCi: TypeScript is
 * perfectly happy with a hand-written `<div className="flex flex-col gap-6">`, a page that threads
 * one loading flag through every region, and a branch that takes `children`. All three compile, all
 * three render, and all three are refused by canon — which the target's own ESLint plugin already
 * knows how to say, at `error`, in one command.
 *
 * The cost of leaving this to the author was paid in full at least once: a candidate was written,
 * reviewed, built, logged and carried to the edge of approval before anybody ran the rules it was
 * supposed to have been written against. Eighty-one violations were waiting, including a branch
 * whose whole shape had to be replaced. None of that is a review failure. It is what happens when
 * the cheapest check in the toolchain is the one the gate does not ask for.
 *
 * So lint is an artifact here on exactly the same terms as the build: a command somebody ran, an
 * exit code, and a log that is hashed and sealed with everything else. `exitCode` must be 0 —
 * warnings that a repository chose to keep are its own business, but an error is a refusal.
 */
const lint = record.candidate.lint
requireValue(lint?.command, "candidate.lint.command is required - the candidate must pass the target's canon lint, not only its build")
if (lint?.exitCode !== 0) {
    fail(`Candidate lint did not pass: exitCode ${lint?.exitCode ?? "<absent>"}`)
}
const lintLogHash = fileHash(lint.log?.path)
if (sealMode) lint.log.sha256 = lintLogHash
else if (lint.log.sha256 !== lintLogHash) fail(`lint log hash drift: ${lint.log.path}`)

/**
 * Why coverage is checked and not only the rendered states.
 *
 * `states` is the list of things that were looked at, and a record can be complete about those
 * while saying nothing about what was skipped. Omission has no field of its own, which is what
 * makes it silent: the reviewer sees four convincing states and cannot tell whether the fifth was
 * considered and ruled out or never thought of. `stateCoverage` is where that difference is
 * written down, so it is checked as hard as the screenshots.
 */
const renderedIds = new Set(record.states.map((state) => state.stateId))
if (!Array.isArray(record.stateCoverage) || record.stateCoverage.length === 0) {
    fail("stateCoverage must classify at least one owner state")
}
for (const entry of record.stateCoverage) {
    const label = `${entry.ownerId ?? "<no owner>"}:${entry.state ?? "<no state>"}`
    requireValue(entry.ownerId, "every stateCoverage entry needs ownerId")
    requireValue(entry.state, `stateCoverage ${label} needs state`)
    if (!["rendered", "covered-by", "not-applicable"].includes(entry.coverage)) {
        fail(`stateCoverage ${label} must be rendered, covered-by or not-applicable`)
    }
    if (entry.coverage === "not-applicable") {
        requireValue(entry.evidence, `stateCoverage ${label} claims not-applicable with no evidence`)
    } else if (!renderedIds.has(entry.scenarioId)) {
        fail(`stateCoverage ${label} names scenario ${entry.scenarioId ?? "<none>"}, which no rendered state provides`)
    }
}
const classifiedOwners = new Set(record.stateCoverage.map((entry) => entry.ownerId))
for (const state of record.states) {
    if (!classifiedOwners.has(state.ownerId)) {
        fail(`Owner ${state.ownerId} renders a state but classifies none of its own`)
    }
}

/**
 * Why three more collections are checked as hard as the screenshots.
 *
 * Approval happens by looking, and looking cannot see three whole classes of defect: a seam that
 * separates the wrong level of grouping, a product decision the reader never knew was taken, and a
 * component rebuilt beside the one that already draws it. All three survive any number of
 * revisions, because every revision is judged on a picture and none of the three is IN the picture.
 *
 * So each gets a field, and a field left empty is a claim the record is making rather than a
 * formality: `relationships` says what the seams and ranks mean, `openQuestions` says which choices
 * were the reader's to make, and `consolidation` says what each new owner was compared against.
 * `keep-apart` carries the distinguishing fact because a pair kept apart without one is a pair
 * nobody compared - two components that render identically can still be two components, and only
 * the fact says which case this is.
 */
if (!Array.isArray(record.relationships) || record.relationships.length === 0) {
    fail("relationships must state at least one seam, rank or variant decision")
}
for (const entry of record.relationships) {
    const label = entry?.subject ?? "<no subject>"
    if (!["seam", "rank", "variant"].includes(entry?.kind)) {
        fail(`relationship ${label} must be kind seam, rank or variant`)
    }
    requireValue(entry.subject, "every relationship needs a subject")
    requireValue(entry.decision, `relationship ${label} needs the decision taken`)
    requireValue(entry.reason, `relationship ${label} states no reason, which is the only part a reader can refuse`)
}

if (!Array.isArray(record.openQuestions)) {
    fail("openQuestions must be present, as an array - an absent list is not the same claim as an empty one")
}
for (const entry of record.openQuestions) {
    const label = entry?.question ?? "<no question>"
    requireValue(entry.question, "every open question needs its question")
    requireValue(entry.default, `open question ${label} needs the default that was taken`)
    requireValue(entry.cost, `open question ${label} needs what that default costs`)
    if (!["answered", "waived"].includes(entry.resolution)) {
        fail(`open question ${label} must end answered or waived before the seal`)
    }
    requireValue(entry.answeredBy, `open question ${label} claims ${entry.resolution} with no evidence of who said so`)
}

if (!Array.isArray(record.newOwners)) fail("newOwners must be present, as an array")
if (!Array.isArray(record.consolidation)) fail("consolidation must be present, as an array")
const settled = new Set()
for (const entry of record.consolidation) {
    const label = entry?.ownerId ?? "<no owner>"
    requireValue(entry.ownerId, "every consolidation verdict needs its ownerId")
    if (!Array.isArray(entry.kin)) fail(`consolidation ${label} needs kin, as an array`)
    if (!["merge", "prop-variant", "extract-composite", "keep-apart"].includes(entry.verdict)) {
        fail(`consolidation ${label} must end at merge, prop-variant, extract-composite or keep-apart`)
    }
    if (entry.verdict === "keep-apart") {
        requireValue(entry.distinguishingFact, `consolidation ${label} keeps a pair apart and names no distinguishing fact`)
    }
    settled.add(entry.ownerId)
}
for (const owner of record.newOwners) {
    if (!settled.has(owner)) fail(`New owner ${owner} carries no consolidation verdict`)
}

/**
 * Why approval must name the revision, and how a bare "ok" is recorded honestly.
 *
 * Approval is what turns an artifact into something Apply may write into production, so the record
 * has to say which revision was approved and how that was established. The common answer is not
 * "I approve revision 1.3" — it is "ok", or "looks good", said after several revisions exist. That
 * is a real approval of a specific thing only if the thing was named back first. So a restated
 * approval is allowed and is stored as what it was: the restatement carries the revision, the
 * source carries the user's own words, and neither is allowed to stand in for the other.
 */
if (!["explicit", "confirmed-restated"].includes(record.approval?.kind)) {
    fail("approval.kind must be explicit or confirmed-restated")
}
if (record.approval.kind === "explicit" && !String(record.approval.source).includes(record.approvedRevision)) {
    fail(`Explicit approval evidence does not name revision ${record.approvedRevision}`)
}
if (record.approval.kind === "confirmed-restated") {
    requireValue(record.approval.restatement, "a confirmed-restated approval must record what was named back")
    if (!String(record.approval.restatement).includes(record.approvedRevision)) {
        fail(`The restatement does not name revision ${record.approvedRevision}`)
    }
}

const history = Array.isArray(record.revisionHistory) ? record.revisionHistory : []
if (!history.some((entry) => (entry?.revision ?? entry) === record.approvedRevision)) {
    fail(`approvedRevision ${record.approvedRevision} is absent from revisionHistory`)
}
if (record.preview?.revision !== record.approvedRevision) {
    fail("preview.revision must be the revision that was approved")
}

record.seal = { algorithm: "sha256", manifestSha256: record.seal?.manifestSha256 ?? "" }
const manifestRecord = structuredClone(record)
manifestRecord.seal.manifestSha256 = ""
const manifestSha256 = createHash("sha256")
    .update(JSON.stringify(stable(manifestRecord)))
    .digest("hex")

if (sealMode) {
    record.seal.manifestSha256 = manifestSha256
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8")
    console.log(JSON.stringify({ ok: true, sealed: recordPath, manifestSha256 }, null, 2))
} else {
    if (record.seal.algorithm !== "sha256") fail("seal.algorithm must be sha256")
    if (record.seal.manifestSha256 !== manifestSha256) fail("Design record semantic drift")
    console.log(JSON.stringify({ ok: true, record: recordPath, manifestSha256 }, null, 2))
}
