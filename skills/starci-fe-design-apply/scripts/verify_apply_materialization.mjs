/**
 * The Apply gate.
 *
 *   node verify_apply_materialization.mjs <design-record.json> --target <target-repo-root>
 *
 * WHY THIS EXISTS. Apply is the only phase that writes production, and its whole promise is a
 * negative one: that what landed is what was approved, and not something easier that looks like it.
 * That promise was carried entirely by prose — read every diff, do not substitute a component —
 * while the sealed record already held the two things needed to check it mechanically: the sha256
 * of every approved file, and the exact path each one was going to.
 *
 * So the phase most able to be checked was the phase least checked, and the failure it invites is
 * the quiet one: a component swapped for a similar one, a token class rewritten by hand, a file
 * that was never written at all while the run reports success because the tests it did run passed.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It cannot judge visual parity, and it does not try. A file
 * whose bytes differ is not automatically wrong either — the record may permit named environment
 * integration edits — but the difference has to be DECLARED. An undeclared difference and a missing
 * file are the two things this refuses, because both mean the diff no longer matches the approval.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

const argument = (name) => {
    const index = process.argv.indexOf(name)
    return index === -1 ? undefined : process.argv[index + 1]
}

const [, , recordArgument] = process.argv
const targetArgument = argument("--target")

if (recordArgument === undefined || recordArgument.startsWith("--") || targetArgument === undefined) {
    console.error("Usage: node verify_apply_materialization.mjs <design-record.json> --target <target-repo-root>")
    process.exit(2)
}

const recordPath = resolve(recordArgument)
if (!existsSync(recordPath)) {
    console.error(`Missing design record: ${recordPath}`)
    process.exit(2)
}
const targetRoot = resolve(targetArgument)
if (!existsSync(targetRoot) || !statSync(targetRoot).isDirectory()) {
    console.error(`Target repository root does not exist: ${targetRoot}`)
    process.exit(2)
}

const record = JSON.parse(readFileSync(recordPath, "utf8"))
const recordDirectory = dirname(recordPath)
const hashOf = (path) => createHash("sha256").update(readFileSync(path)).digest("hex")

/** Repeated from the seal step on purpose: a boundary is checked where it is crossed, not only where it is written. */
const escapes = (targetPath) =>
    isAbsolute(targetPath)
    || /^[a-zA-Z]:[\\/]/.test(targetPath)
    || /^[\\/]/.test(targetPath)
    || targetPath.split(/[\\/]+/).includes("..")

const declaredEdits = new Map(
    (Array.isArray(record.integrationEdits) ? record.integrationEdits : [])
        .map((edit) => [edit.targetPath, edit.reason]),
)

const files = Array.isArray(record.candidate?.files) ? record.candidate.files : []
if (files.length === 0) {
    console.error("The design record names no candidate files to materialize")
    process.exit(1)
}

const outcome = { materialized: [], integrated: [], missing: [], substituted: [], outOfBounds: [] }

for (const file of files) {
    const targetPath = file.targetPath
    if (escapes(targetPath)) {
        outcome.outOfBounds.push(targetPath)
        continue
    }
    const landed = join(targetRoot, targetPath)
    if (!existsSync(landed)) {
        outcome.missing.push(targetPath)
        continue
    }
    // The approved content is the sealed hash, not the candidate file as it stands now: if the
    // candidate itself drifted after approval, the seal verifier is what says so, and this must not
    // quietly agree with the drifted version.
    const approved = file.sha256
    if (approved === undefined || approved === "") {
        outcome.substituted.push(`${targetPath} (candidate carries no sealed hash)`)
        continue
    }
    if (hashOf(landed) === approved) {
        outcome.materialized.push(targetPath)
        continue
    }
    const reason = declaredEdits.get(targetPath)
    if (reason === undefined || reason === "") outcome.substituted.push(targetPath)
    else outcome.integrated.push({ targetPath, reason })
}

const blocked = outcome.missing.length + outcome.substituted.length + outcome.outOfBounds.length
const report = {
    ok: blocked === 0,
    record: recordPath,
    target: targetRoot,
    approvedRevision: record.approvedRevision,
    ...outcome,
}
console.log(JSON.stringify(report, null, 2))

if (blocked > 0) {
    console.error(
        "\nApply is not materialized. A target that is absent, altered without a declared reason, or "
        + "outside the confirmed boundary means the diff no longer matches what was approved. "
        + "Declare the edit in integrationEdits with its reason, or return to Preview.",
    )
    process.exit(1)
}
