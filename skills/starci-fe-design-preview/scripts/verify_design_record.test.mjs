import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const verifier = new URL("./verify_design_record.mjs", import.meta.url).pathname.replace(/^\/(.:)/, "$1")

const createRecord = () => {
    const root = mkdtempSync(join(tmpdir(), "starci-design-record-"))
    mkdirSync(join(root, "candidate"))
    mkdirSync(join(root, "fixtures"))
    mkdirSync(join(root, "screens"))
    writeFileSync(join(root, "candidate", "Profile.tsx"), "export const Profile = () => null\n")
    writeFileSync(join(root, "fixtures", "owner.json"), "{\"persona\":\"owner\"}\n")
    writeFileSync(join(root, "screens", "owner.png"), "approved-screen")
    writeFileSync(join(root, "build.log"), "tsc --noEmit\nexit 0\n")
    writeFileSync(join(root, "lint.log"), "eslint candidate/src\nexit 0\n")
    const recordPath = join(root, "design-record.json")
    writeFileSync(recordPath, JSON.stringify({
        version: 3,
        caseId: "profile",
        approvedRevision: "1.2",
        revisionHistory: [{ revision: "1.0" }, { revision: "1.1" }, { revision: "1.2" }],
        approval: { kind: "explicit", source: "Approve revision 1.2" },
        preview: { revision: "1.2", url: "http://127.0.0.1:8080" },
        candidate: {
            root: join(root, "candidate"),
            framework: "Next.js",
            buildCommand: "npm run typecheck",
            build: {
                command: "npm run typecheck",
                exitCode: 0,
                log: { path: "build.log", sha256: "" },
            },
            lint: {
                command: "npx eslint candidate/src",
                exitCode: 0,
                log: { path: "lint.log", sha256: "" },
            },
            files: [{ path: "candidate/Profile.tsx", targetPath: "src/Profile.tsx", sha256: "" }],
        },
        stateCoverage: [
            {
                ownerId: "page-profile",
                state: "populated",
                coverage: "rendered",
                scenarioId: "profile-owner-light-en",
                evidence: "owner fixture resolves every field",
            },
            {
                ownerId: "page-profile",
                state: "guest-redirect",
                coverage: "not-applicable",
                evidence: "the route is behind the authenticated layout",
            },
        ],
        states: [{
            stateId: "profile-owner-light-en",
            ownerId: "page-profile",
            route: "/profile/test",
            viewport: { width: 1440, height: 1000, dpr: 1 },
            locale: "en",
            theme: "light",
            authPersona: "owner",
            coverage: "rendered",
            fixture: { path: "fixtures/owner.json", sha256: "" },
            screenshot: { path: "screens/owner.png", sha256: "" },
            componentTree: [],
            contracts: [],
            props: [],
            tokens: [],
        }],
        relationships: [
            {
                kind: "seam",
                subject: "profile-identity-stack",
                decision: "gap-3",
                reason: "the name and the handle beneath it are one identity, and the card below is a second unit",
            },
        ],
        openQuestions: [
            {
                question: "does the empty state offer a recovery action",
                default: "it does",
                cost: "one control on a screen with nothing to recover",
                resolution: "answered",
                answeredBy: "keep the action",
            },
        ],
        newOwners: ["page-profile"],
        consolidation: [
            {
                ownerId: "page-profile",
                kin: ["page-account"],
                verdict: "keep-apart",
                distinguishingFact: "a different domain entity - one renders a viewer, the other an account",
            },
        ],
        seal: { algorithm: "sha256", manifestSha256: "" },
    }, null, 2))
    return { root, recordPath }
}

test("seals and verifies an executable design record", () => {
    const { recordPath } = createRecord()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    const output = execFileSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("rejects candidate drift after approval", () => {
    const { root, recordPath } = createRecord()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    writeFileSync(join(root, "candidate", "Profile.tsx"), "export const Profile = () => 'redesigned'\n")
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Candidate hash drift/)
})

test("rejects semantic record drift after approval", () => {
    const { recordPath } = createRecord()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    const record = JSON.parse(readFileSync(recordPath, "utf8"))
    record.states[0].theme = "dark"
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /semantic drift/)
})

/** Create a valid record, change exactly one thing, and demand the seal step refuse it. */
const refuses = (patch, pattern) => {
    const { root, recordPath } = createRecord()
    const record = JSON.parse(readFileSync(recordPath, "utf8"))
    patch(record, root)
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
    const result = spawnSync(process.execPath, [verifier, recordPath, "--seal"], { encoding: "utf8" })
    assert.notEqual(result.status, 0, `sealed a record it should refuse: ${pattern}`)
    assert.match(result.stderr, pattern)
}

test("rejects a record that states no relationship", () => {
    refuses((record) => { record.relationships = [] }, /at least one seam, rank or variant/)
})

test("rejects a relationship stated without its reason", () => {
    refuses((record) => { record.relationships[0].reason = "" }, /states no reason/)
})

test("rejects an open question left neither answered nor waived", () => {
    refuses((record) => { record.openQuestions[0].resolution = "pending" }, /must end answered or waived/)
})

test("rejects an answered question with nobody behind the answer", () => {
    refuses((record) => { record.openQuestions[0].answeredBy = "" }, /no evidence of who said so/)
})

test("rejects an absent open-question list, which is not the same claim as an empty one", () => {
    refuses((record) => { delete record.openQuestions }, /openQuestions must be present/)
})

test("rejects a new owner carrying no consolidation verdict", () => {
    refuses((record) => { record.newOwners.push("leaf-invented") }, /carries no consolidation verdict/)
})

test("rejects a pair kept apart with no distinguishing fact", () => {
    refuses((record) => { record.consolidation[0].distinguishingFact = "" }, /names no distinguishing fact/)
})

test("rejects a verdict outside the four the consolidate skill owns", () => {
    refuses((record) => { record.consolidation[0].verdict = "looks-different" }, /merge, prop-variant, extract-composite or keep-apart/)
})

test("rejects a candidate whose build did not pass", () => {
    refuses((record) => { record.candidate.build.exitCode = 1 }, /build did not pass/)
})

test("rejects a build nobody actually ran", () => {
    refuses((record) => { delete record.candidate.build }, /candidate\.build\.command is required/)
})

/**
 * A build proves the candidate EXECUTES. These three prove it is StarCi.
 *
 * TypeScript compiles a hand-written `flex flex-col gap-6`, a page that threads one loading flag
 * through every region, and a branch that takes `children`. Canon refuses all three, and the
 * target's own plugin already says so at `error`. Leaving that to the author is how a candidate
 * reaches the edge of approval with dozens of violations nobody ran the command to see.
 */
test("rejects a candidate whose canon lint did not pass", () => {
    refuses((record) => { record.candidate.lint.exitCode = 1 }, /lint did not pass/)
})

test("rejects lint nobody actually ran", () => {
    refuses((record) => { delete record.candidate.lint }, /candidate\.lint\.command is required/)
})

test("rejects a lint log that changed after approval", () => {
    const { root, recordPath } = createRecord()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    writeFileSync(join(root, "lint.log"), "eslint candidate/src\nexit 0\n81 problems suppressed\n")
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /lint log hash drift/)
})

test("rejects a build log that changed after approval", () => {
    const { root, recordPath } = createRecord()
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    writeFileSync(join(root, "build.log"), "tsc --noEmit\nexit 0\n2 errors suppressed\n")
    const result = spawnSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /build log hash drift/)
})

test("rejects coverage that points at a scenario nothing rendered", () => {
    refuses((record) => { record.stateCoverage[0].scenarioId = "profile-owner-dark-vi" }, /which no rendered state provides/)
})

test("rejects a not-applicable claim carrying no evidence", () => {
    refuses((record) => { record.stateCoverage[1].evidence = "" }, /claims not-applicable with no evidence/)
})

test("rejects an owner that renders a state while classifying none of its own", () => {
    refuses((record) => {
        for (const entry of record.stateCoverage) entry.ownerId = "block-somewhere-else"
    }, /renders a state but classifies none/)
})

test("rejects approval evidence that never names the revision", () => {
    refuses((record) => { record.approval.source = "looks good, ship it" }, /does not name revision 1\.2/)
})

test("accepts a bare confirmation when the revision was named back first", () => {
    const { recordPath } = createRecord()
    const record = JSON.parse(readFileSync(recordPath, "utf8"))
    record.approval = {
        kind: "confirmed-restated",
        restatement: "Approve revision 1.2 as shown?",
        source: "ok",
    }
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
    execFileSync(process.execPath, [verifier, recordPath, "--seal"])
    const output = execFileSync(process.execPath, [verifier, recordPath], { encoding: "utf8" })
    assert.equal(JSON.parse(output).ok, true)
})

test("rejects a restatement that names a revision other than the approved one", () => {
    refuses((record) => {
        record.approval = { kind: "confirmed-restated", restatement: "Approve revision 1.1?", source: "ok" }
    }, /restatement does not name revision 1\.2/)
})

test("rejects an approved revision the history never recorded", () => {
    refuses((record) => { record.revisionHistory = [{ revision: "1.0" }, { revision: "1.1" }] }, /absent from revisionHistory/)
})

test("rejects a preview still hosting a revision other than the approved one", () => {
    refuses((record) => { record.preview.revision = "1.1" }, /preview\.revision must be the revision that was approved/)
})

test("rejects a targetPath that leaves the confirmed write boundary", () => {
    for (const escaping of ["/etc/profile.tsx", "C:\\Windows\\Profile.tsx", "../../other-repo/src/Profile.tsx"]) {
        const { recordPath } = createRecord()
        const record = JSON.parse(readFileSync(recordPath, "utf8"))
        record.candidate.files[0].targetPath = escaping
        writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
        const result = spawnSync(process.execPath, [verifier, recordPath, "--seal"], { encoding: "utf8" })
        assert.notEqual(result.status, 0, `${escaping} was sealed instead of refused`)
        assert.match(result.stderr, /Candidate targetPath/)
    }
})

test("rejects a candidate file outside candidate.root", () => {
    const { root, recordPath } = createRecord()
    writeFileSync(join(root, "outside.tsx"), "export const Outside = () => null\n")
    const record = JSON.parse(readFileSync(recordPath, "utf8"))
    record.candidate.files[0].path = "outside.tsx"
    writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`)
    const result = spawnSync(process.execPath, [verifier, recordPath, "--seal"], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /escapes candidate\.root/)
})
