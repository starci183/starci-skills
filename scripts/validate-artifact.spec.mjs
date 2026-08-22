import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import test from "node:test"

const digest = "a".repeat(64)
const tokens = ["ground", "surface", "content", "muted", "accent", "separator", "display", "body", "label", "radius", "elevation", "duration", "easing"]
const roleToken = (token) => ({ verdict: "reuse", token: `--${token}` })
const direction = {
    id: "calm-command",
    vocabularyAt: digest,
    axes: { contrast: "balanced", density: "balanced", shape: "soft", depth: "flat", motion: "still" },
    citesPrecedent: "none",
    personality: ["calm", "precise", "focused"],
    roles: {
        ground: roleToken("ground"), surface: roleToken("surface"), content: roleToken("content"),
        mutedContent: roleToken("muted"), accent: roleToken("accent"), separator: roleToken("separator"),
        display: roleToken("display"), body: roleToken("body"), label: roleToken("label"), radius: roleToken("radius"),
        elevation: roleToken("elevation"), duration: roleToken("duration"), easing: roleToken("easing"),
    },
    rejects: ["decorative noise"],
    reason: "Keep the page focused on the learner task.",
}

const existingShell = {
    id: "app-shell", kind: "app-layout", change: "existing",
    source: "src/app/layout.tsx", sourceHash: "b".repeat(64),
}

const region = (pageId, name) => ({
    name, pageId, change: "proposed",
    entry: { verdict: "reuse", key: "content-panel" },
    assembler: "Tree", mount: "per-route", whyMatch: "The page needs one readable content region.",
    geometry: { placement: "main", width: "wide", height: "content", align: "stretch" },
    brief: { kind: "content", title: "Content", summary: "The complete page content in reading order.", items: [{ role: "text", label: "Representative content" }] },
})

const axes = [
    { navigation: "navbar", evidence: "beside", secondary: "panel", chrome: "sticky" },
    { navigation: "rail", evidence: "beside", secondary: "panel", chrome: "sticky" },
    { navigation: "navbar", evidence: "below", secondary: "overlay", chrome: "scrolls" },
]

const pageCandidate = (id, axis, sourceHash = existingShell.sourceHash) => ({
    id, direction, axes: axis, citesPrecedent: id === "one" ? "none" : "course-page",
    pages: [{
        id: "lesson", route: "/courses/course/learn/lesson", state: "lesson-ready",
        nodes: [{ ...existingShell, sourceHash }, { id: "lesson-page", kind: "page", change: "proposed", parentId: "app-shell" }],
        regions: ["lesson-content"],
    }],
    regions: [region("lesson", "lesson-content")],
    reason: `Complete composed lesson choice ${id}.`,
})

const addRenderContract = (candidate) => {
    const sourceBoundary = ["src/components/pages/LessonPage/component.tsx", "src/components/pages/LessonPage/index.tsx"]
    const page = candidate.pages[0]
    candidate.renderContract = {
        id: `${candidate.id}-render`, candidateId: candidate.id, sourceBoundary,
        viewports: [{id: "desktop", width: 1440, height: 900}, {id: "mobile", width: 390, height: 844}],
        pages: [{
            id: page.id, route: page.route, states: [page.state], pageStates: [page.state], transitions: [],
            regions: page.regions.map((id) => ({
                id, owner: "LessonPage", component: "LessonContent", contract: "content-panel",
                anatomy: ["title", "body"],
                data: {owner: "LessonPage", source: "lesson query", mapping: ["lesson.title -> title"], states: [page.state], previewContent: "representative-fixture", runtimeTruth: "source-owned"},
                sourceOwnership: {stateOwner: "page", drawing: {component: "LessonPageBase", path: "src/components/pages/LessonPage/component.tsx"}, connected: {component: "LessonPage", path: "src/components/pages/LessonPage/index.tsx"}, compositorKind: "page", compositor: {component: "LessonPageBase", path: "src/components/pages/LessonPage/component.tsx"}, entry: {component: "LessonPage", path: "src/components/pages/LessonPage/index.tsx"}, parentUses: "connected-component"},
                visual: {typography: ["Heading scale display is locally opt-in at the page root"], controls: [], surface: ["content panel"], geometry: ["wide main region"]},
            })),
        }],
        renders: [
            {pageId: page.id, stateId: page.state, viewportId: "desktop", regions: page.regions},
            {pageId: page.id, stateId: page.state, viewportId: "mobile", regions: page.regions},
        ],
    }
    candidate.executionPrompt = {
        candidateId: candidate.id, renderContractId: candidate.renderContract.id, sourceBoundary,
        implementationMode: "exact-render-contract", reinterpretation: "forbidden", proofMode: "same-state-same-viewport-parity",
        instructions: ["read-exact-render-contract", "implement-every-page-region-state-viewport-transition-obligation", "touch-only-source-boundary", "do-not-reinterpret-preview", "stop-if-obligation-is-unrepresentable", "prove-preview-source-same-state-same-viewport-with-zero-mismatches"],
    }
    return candidate
}

const canonical = (value) => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
    return JSON.stringify(value)
}

const qualityReview = (scope, targetId) => ({
    schema: 1,
    scope,
    targetId,
    evidenceAt: digest,
    sources: [{
        id: "current-product",
        kind: "current-source",
        locator: "src/components/current.tsx",
        digest,
        use: "binding",
        lenses: ["product-fit", "visual-character", "design-system", "accessibility", "interaction", "responsive-content", "performance-motion", "component-composition", "state-resilience", "copy-localization"],
    }],
    lenses: [
        "product-fit", "visual-character", "design-system", "accessibility", "interaction",
        "responsive-content", "performance-motion", "component-composition", "state-resilience", "copy-localization",
    ].map((id) => ({
        id,
        verdict: "pass",
        evidence: [`Current product evidence closes ${id}`],
        decision: `Preserve the product-specific ${id} obligation`,
        owner: id === "product-fit" ? "business" : id === "component-composition" ? "pattern" : "grammar",
        proof: `The complete candidate visibly proves ${id}`,
    })),
    signature: {
        move: "Make the learner decision visibly anchor the composition",
        productReason: "The learner must judge whether the lesson is sufficient",
        authority: scope === "block" ? "inherited-parent" : "master",
        decorativeOnly: false,
    },
    rejections: ["Reject generic dashboard composition with no learner-specific decision"],
    detectors: [
        "semantics-a11y", "interaction-feedback", "responsive-overflow",
        "motion-performance", "react-composition", "state-content",
    ].map((id) => ({id, verdict: "pass", evidence: `Deterministic evidence passes ${id}`})),
    verdict: "eligible",
})

const addPageSynthesis = (candidate) => {
    const page = candidate.pages[0]
    candidate.synthesis = {
        pageIntents: [{
            pageId: page.id, route: page.route, actor: "Learner", entry: "Open a course lesson",
            intent: "Understand the addressed lesson", decision: "Whether the explanation is sufficient",
            outcome: "Continue with confidence", failureConsequence: "Show a recoverable lesson error",
            renderIntents: [{id: "lesson-reading", mustRender: "Authorized lesson content in a readable region", evidence: ["learner journey", "course content contract"]}],
        }],
        customerJourneys: [{
            id: "learner-journey", actor: "Learner", goal: "Understand the lesson", entry: "Open a course lesson", outcome: "Continue with confidence",
            steps: [{id: "read-lesson", intent: "Understand one concept", decision: "Whether the explanation is sufficient", action: "Read the lesson", consequence: "The learner can continue", pageId: page.id}],
        }],
        business: {
            feature: "Course learning", head: "implemented/course-learning", objective: "Help a learner finish useful material",
            rules: ["Only enrolled learners can read protected content"], operations: ["Read a lesson"], dataOwners: ["Course content service"],
        },
        capabilities: page.regions.map((regionId) => ({
            regionId, verdict: "reuse", owner: "LessonPage", component: "LessonContent", contract: "content-panel",
            sourcePaths: ["src/components/pages/LessonPage/component.tsx"], why: "The existing content owner already serves this journey obligation.",
        })),
        intersections: [{
            pageId: page.id, journeyStepIds: ["read-lesson"], businessObligations: ["Render authorized lesson content"], regionIds: page.regions,
            bindings: [{renderIntentId: "lesson-reading", journeyStepIds: ["read-lesson"], businessObligations: ["Render authorized lesson content"], regionIds: page.regions}],
        }],
    }
    candidate.pageContract = {
        id: `${candidate.id}-pages`, candidateId: candidate.id,
        viewports: [{id: "desktop", width: 1440, height: 900}, {id: "mobile", width: 390, height: 844}],
        pages: [{
            pageId: page.id, route: page.route, representativeState: page.state, journeyStepIds: ["read-lesson"], regions: page.regions,
            hierarchy: ["Lesson purpose precedes lesson body"], density: ["One primary reading column"], responsive: ["Rail collapses before content narrows"],
            visualPrecedent: "StarCi course learning page", sourceFeasibility: "passed",
        }],
        stateInventory: [{pageId: page.id, states: [page.state, "lesson-loading", "lesson-error"], pageStates: [page.state], conditions: ["Ready after authorized content resolves", "Loading while the query is pending", "Error when the query fails"]}],
        renders: [
            {pageId: page.id, stateId: page.state, viewportId: "desktop", regions: page.regions},
            {pageId: page.id, stateId: page.state, viewportId: "mobile", regions: page.regions},
        ],
    }
    return candidate
}

const addSchema8CapabilityProof = (candidate, routeStatus = "existing") => {
    for (const pageIntent of candidate.synthesis.pageIntents) pageIntent.routeStatus = routeStatus
    const pageIds = candidate.pages.map((page) => page.id)
    candidate.synthesis.directionReceipt = {
        journey: {
            summary: "Move the actor through one ordered experience to the declared terminal outcome",
            pageIds,
            waypoints: candidate.synthesis.customerJourneys.flatMap((journey) => journey.steps.map((step) => step.action)),
            terminalOutcome: candidate.synthesis.customerJourneys[0].outcome,
        },
        ui: {
            summary: `Compose ${candidate.id} as one complete responsive hierarchy for the full scope`,
            pageIds,
            hierarchy: candidate.pageContract.pages.flatMap((page) => page.hierarchy),
            responsive: candidate.pageContract.pages.flatMap((page) => page.responsive),
            emphasis: ["Keep the decisive action and terminal outcome visibly dominant"],
        },
    }
    for (const capability of candidate.synthesis.capabilities) {
        const renderIntentIds = candidate.synthesis.intersections.flatMap((intersection) =>
            intersection.bindings
                .filter((binding) => binding.regionIds.includes(capability.regionId))
                .map((binding) => binding.renderIntentId))
        capability.obligations = renderIntentIds.map((renderIntentId) => ({
            renderIntentId,
            observable: `${capability.component} visibly renders the bound intent with complete anatomy`,
            verdict: "supported",
            evidence: [`${capability.component} in ${capability.sourcePaths[0]} owns the observable anatomy`],
            requiredPaths: [],
        }))
    }
    return candidate
}

const pageHash = (candidate, schema = 7) => createHash("sha256")
    .update(canonical(schema === 9
        ? {directionReceipt: candidate.synthesis.directionReceipt, qualityReview: candidate.synthesis.qualityReview, pageContract: candidate.pageContract}
        : schema === 8
            ? {directionReceipt: candidate.synthesis.directionReceipt, pageContract: candidate.pageContract}
            : candidate.pageContract))
    .digest("hex")

function runArtifact(artifact, schemaFile = "brainstorms/layouts/schema.json") {
    const root = mkdtempSync(join(tmpdir(), "validate-page-set-"))
    const artifactPath = join(root, "artifact.json")
    const vocabularyPath = join(root, "vocabulary.json")
    writeFileSync(artifactPath, JSON.stringify(artifact))
    writeFileSync(vocabularyPath, JSON.stringify({
        schema: 1, root, digest, sources: ["tokens.css"],
        tokens: tokens.map((name) => ({ name: `--${name}`, declarations: [{ source: "tokens.css", value: name }] })),
    }))
    const result = spawnSync(process.execPath, [
        resolve("scripts/validate-artifact.mjs"), "--schema", resolve(schemaFile),
        "--data", artifactPath, "--vocabulary", vocabularyPath,
    ], { cwd: resolve("."), encoding: "utf8" })
    rmSync(root, { recursive: true, force: true })
    return result
}

const batch = (candidates, scope = { kind: "page", source: "screenshot" }) => ({
    schema: 4,
    envelope: { round: 1, project: "sample", surface: "course-learning", scope },
    candidates,
})

const statesArtifact = (schema = 8) => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    if (schema >= 8) addSchema8CapabilityProof(candidate)
    if (schema === 9) candidate.synthesis.qualityReview = qualityReview("layout", candidate.id)
    const approvedPageAt = pageHash(candidate, schema)
    addRenderContract(candidate)
    const states = candidate.pageContract.stateInventory[0].states
    candidate.renderContract.pages[0].states = states
    const lessonRegion = candidate.renderContract.pages[0].regions[0]
    lessonRegion.data.states = states
    lessonRegion.sourceOwnership = {
        stateOwner: "block",
        drawing: {component: "LessonContentBase", path: "src/components/blocks/LessonContent/component.tsx"},
        connected: {component: "LessonContent", path: "src/components/blocks/LessonContent/index.tsx"},
        compositorKind: "page",
        compositor: {component: "LessonPageBase", path: "src/components/pages/LessonPage/component.tsx"},
        entry: {component: "LessonPage", path: "src/components/pages/LessonPage/index.tsx"},
        parentUses: "connected-component",
    }
    const blockPaths = ["src/components/blocks/LessonContent/component.tsx", "src/components/blocks/LessonContent/index.tsx"]
    candidate.renderContract.sourceBoundary.push(...blockPaths)
    candidate.renderContract.renders = candidate.renderContract.viewports.map((viewport) => ({
        pageId: "lesson", stateId: "lesson-error", viewportId: viewport.id, regions: ["lesson-content"],
        ...(schema === 9 ? {visibleBlockStates: ["lesson-error"]} : {}),
    }))
    if (schema === 9) candidate.renderContract.seedOwners = [{
        pageId: "lesson",
        stateId: "lesson-error",
        identity: "learner@example.test",
        requiredStates: ["lesson-error"],
        owner: "course development seeder",
        provision: {kind: "existing-command", command: "npm run seed:development -- --identity learner@example.test"},
        idempotencyKey: "lesson-error-learner",
        runtimeDependencies: ["local database"],
        safeRepeat: "Upsert the same test identity and lesson error fixture",
        readPath: "/courses/course/learn/lesson",
    }]
    const artifact = {...batch([candidate]), schema}
    artifact.envelope.mode = "expand-states"
    artifact.envelope.stage = "states"
    artifact.envelope.approvedPageAt = approvedPageAt
    return {artifact, candidate}
}

test("schema 4 accepts three complete single-page choices with source-bound existing layouts", () => {
    const result = runArtifact(batch(axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))))
    assert.equal(result.status, 0, result.stderr)
})

test("schema 5 generate emits one complete result under StarCi MASTER", () => {
    const candidates = [axes[0]].map((axis, index) => {
        const candidate = pageCandidate(["one"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: []}
        return candidate
    })
    const artifact = {...batch(candidates), schema: 5}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 6 accepts a complete render contract and canonical execution prompt", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 7 pages stage accepts journey-business and component synthesis without source authority", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 8 pages stage accepts obligation-level capability evidence while schema 7 stays compatible", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    const artifact = {...batch([candidate]), schema: 8}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 9 pages stage binds one target-matched integrated quality review", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    candidate.synthesis.qualityReview = qualityReview("layout", candidate.id)
    const artifact = {...batch([candidate]), schema: 9}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 9 pages stage refuses a quality receipt for another candidate", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    candidate.synthesis.qualityReview = qualityReview("layout", "another-candidate")
    const artifact = {...batch([candidate]), schema: 9}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /targetId: must equal one/)
})

test("schema 9 pages stage refuses HTML eligibility without a quality review", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    const artifact = {...batch([candidate]), schema: 9}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /schema 9 requires an integrated quality review before HTML/)
})

test("schema 8 pages stage requires separately printed journey and UI directions for the complete scope", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    delete candidate.synthesis.directionReceipt
    const artifact = {...batch([candidate]), schema: 8}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /directionReceipt/)
})

test("schema 8 direction receipt must cover the complete page or flow instead of one page fragment", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    candidate.synthesis.directionReceipt.ui.pageIds = ["other-page"]
    const artifact = {...batch([candidate]), schema: 8}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must cover the complete candidate page\/flow exactly/)
})

test("schema 8 direct brainstorm accepts 3-4 flow-level direction receipts without an earlier baseline", () => {
    const candidates = axes.map((axis, index) => {
        const candidate = pageCandidate(["one", "two", "three"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: [{axis: "composition", from: "shared-scope", to: candidate.id, reason: "Owner explicitly requested alternatives before direction approval."}]}
        return addSchema8CapabilityProof(addPageSynthesis(candidate))
    })
    const artifact = {...batch(candidates), schema: 8}
    artifact.envelope.mode = "brainstorm"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 8 refuses reuse when an observable capability obligation is missing", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addSchema8CapabilityProof(addPageSynthesis(candidate))
    candidate.synthesis.capabilities[0].obligations[0].verdict = "missing"
    candidate.synthesis.capabilities[0].obligations[0].requiredPaths = ["src/components/atoms/TileIcon/index.tsx"]
    const artifact = {...batch([candidate]), schema: 8}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /reuse is forbidden while an obligation is missing/)
})

test("schema 7 pages stage refuses a source handoff before page approval", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    addRenderContract(candidate)
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /pages stage stops before state expansion|cannot carry a source-write handoff/)
})

test("schema 7 states stage preserves the approved page contract, expands every state and bounds visual evidence", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    const approvedPageAt = pageHash(candidate)
    addRenderContract(candidate)
    const states = candidate.pageContract.stateInventory[0].states
    candidate.renderContract.pages[0].states = states
    const lessonRegion = candidate.renderContract.pages[0].regions[0]
    lessonRegion.data.states = states
    lessonRegion.sourceOwnership = {
        stateOwner: "block",
        drawing: {component: "LessonContentBase", path: "src/components/blocks/LessonContent/component.tsx"},
        connected: {component: "LessonContent", path: "src/components/blocks/LessonContent/index.tsx"},
        compositorKind: "page",
        compositor: {component: "LessonPageBase", path: "src/components/pages/LessonPage/component.tsx"},
        entry: {component: "LessonPage", path: "src/components/pages/LessonPage/index.tsx"},
        parentUses: "connected-component",
    }
    candidate.renderContract.sourceBoundary.push("src/components/blocks/LessonContent/component.tsx", "src/components/blocks/LessonContent/index.tsx")
    candidate.renderContract.renders = candidate.renderContract.viewports.map((viewport) => ({
        pageId: "lesson", stateId: "lesson-error", viewportId: viewport.id, regions: ["lesson-content"],
    }))
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "expand-states"
    artifact.envelope.stage = "states"
    artifact.envelope.approvedPageAt = approvedPageAt
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 8 states stage accepts a fully supported capability proof", () => {
    const {artifact} = statesArtifact()
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 9 states stage preserves direction, quality review and page contract after OK #1", () => {
    const {artifact} = statesArtifact(9)
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 9 states stage refuses OK #2 without one product-native seed owner per selected target", () => {
    const {artifact, candidate} = statesArtifact(9)
    delete candidate.renderContract.seedOwners
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /one product-native seed owner per selected render target/)
})

test("schema 9 seed owner must cover every block state visible in the selected complete-page target", () => {
    const {artifact, candidate} = statesArtifact(9)
    for (const render of candidate.renderContract.renders) render.visibleBlockStates = ["lesson-error", "lesson-loading"]
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must exactly cover selected state plus every visible block state/)
})

test("schema 9 states stage refuses quality-review drift after OK #1", () => {
    const {artifact, candidate} = statesArtifact(9)
    candidate.synthesis.qualityReview.signature.move = "A changed character move after approval is forbidden"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /quality review or page anatomy drifted/)
})

test("schema 8 states stage refuses direction drift after OK #1", () => {
    const {artifact, candidate} = statesArtifact()
    candidate.synthesis.directionReceipt.ui.summary = "Replace the approved hierarchy with a different complete responsive composition"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /direction or page anatomy drifted after page approval/)
})

test("schema 8 states stage requires every missing capability path in the exact source boundary", () => {
    const {artifact, candidate} = statesArtifact()
    const capability = candidate.synthesis.capabilities[0]
    capability.verdict = "generalize"
    capability.obligations[0].verdict = "missing"
    capability.obligations[0].requiredPaths = ["src/components/atoms/TileIcon/index.tsx"]
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /missing capability path src\/components\/atoms\/TileIcon\/index\.tsx/)
})

test("schema 8 states stage requires every new or changed route in parity proof", () => {
    const {artifact, candidate} = statesArtifact()
    candidate.synthesis.pageIntents[0].routeStatus = "changed"
    candidate.renderContract.renders = []
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /new\/changed route or non-reuse capability page lesson must enter parity proof/)
})

test("schema 7 states stage refuses page drift and incomplete approved states", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    const approvedPageAt = pageHash(candidate)
    candidate.pageContract.pages[0].hierarchy.push("Unapproved new hierarchy")
    addRenderContract(candidate)
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "expand-states"
    artifact.envelope.stage = "states"
    artifact.envelope.approvedPageAt = approvedPageAt
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /drifted after page approval|must expand the complete approved state inventory/)
})

test("schema 7 forward test composes the Nivo AgentOS journey into a complete page before states", () => {
    const page = {
        id: "agentos", route: "/agentos", state: "agentos-ready",
        nodes: [existingShell, {id: "agentos-page", kind: "page", change: "proposed", parentId: "app-shell"}],
        regions: ["workspace-list", "provisioning-journey"],
    }
    const candidate = {
        id: "agentos-customer-journey", systemId: "starci-master", pageOverride: {deviations: []}, axes: axes[0], pages: [page],
        regions: [region("agentos", "workspace-list"), region("agentos", "provisioning-journey")],
        synthesis: {
            pageIntents: [{
                pageId: "agentos", route: "/agentos", actor: "Nivo account owner", entry: "Open AgentOS from console navigation",
                intent: "Manage an existing workspace or request another", decision: "Open owned capacity or enter provisioning",
                outcome: "Reach the workspace or its next provisioning action", failureConsequence: "Keep ownership visible with an actionable provisioning failure",
                renderIntents: [
                    {id: "owned-workspaces-first", mustRender: "Stable owned workspaces before creation", evidence: ["owner journey", "workspace-list contract"]},
                    {id: "connected-provisioning", mustRender: "One connected five-stage provisioning lifecycle", evidence: ["owner journey", "provisioning contract"]},
                ],
            }],
            customerJourneys: [{
                id: "agentos-owner-journey", actor: "Nivo account owner", goal: "Manage or request an AgentOS workspace", entry: "Open AgentOS from console navigation", outcome: "Reach the existing workspace or a clear provisioning next step",
                steps: [
                    {id: "review-owned-workspaces", intent: "See stable owned workspaces first", decision: "Open an existing workspace or continue to creation", action: "Review workspace identities and lifecycle", consequence: "Existing ownership remains the primary surface", pageId: "agentos"},
                    {id: "request-new-workspace", intent: "Create another workspace", decision: "Whether to submit or resume the order", action: "Follow the five-stage provisioning journey", consequence: "Payment and live provisioning status remain attached to one order", pageId: "agentos"},
                ],
            }],
            business: {
                feature: "AgentOS workspace provisioning", head: "current-source/AgentOSPage", objective: "Compose management before creation and keep one order attached to its live workspace status",
                rules: ["Owned workspaces are the stable AgentOS surface", "New and resumed orders share one page owner"],
                operations: ["Open an owned workspace", "Request or resume workspace provisioning"], dataOwners: ["Agent workspace query", "Catalog order and provisioning status"],
            },
            capabilities: [
                {regionId: "workspace-list", verdict: "reuse", owner: "AgentOSWorkspaceList", component: "AgentOSWorkspaceList", contract: "label-row-over-card", sourcePaths: ["apps/app/src/components/blocks/agentos/AgentOSWorkspaceList/index.tsx"], why: "The current owner already presents stable workspaces before the creation task."},
                {regionId: "provisioning-journey", verdict: "reuse", owner: "AgentOSProvisioning", component: "AgentOSProvisioning", contract: "request-beside-live-status", sourcePaths: ["apps/app/src/components/blocks/provisioning/AgentOSProvisioning/component.tsx"], why: "The current owner already binds five lifecycle stages, request identity and live status."},
            ],
            intersections: [{
                pageId: "agentos", journeyStepIds: ["review-owned-workspaces", "request-new-workspace"], businessObligations: ["Management precedes creation", "Five stages read as one connected lifecycle"], regionIds: page.regions,
                bindings: [
                    {renderIntentId: "owned-workspaces-first", journeyStepIds: ["review-owned-workspaces"], businessObligations: ["Management precedes creation"], regionIds: ["workspace-list"]},
                    {renderIntentId: "connected-provisioning", journeyStepIds: ["request-new-workspace"], businessObligations: ["Five stages read as one connected lifecycle"], regionIds: ["provisioning-journey"]},
                ],
            }],
        },
        pageContract: {
            id: "agentos-pages", candidateId: "agentos-customer-journey",
            viewports: [{id: "desktop", width: 1440, height: 900}, {id: "mobile", width: 390, height: 844}],
            pages: [{
                pageId: "agentos", route: "/agentos", representativeState: "agentos-ready", journeyStepIds: ["review-owned-workspaces", "request-new-workspace"], regions: page.regions,
                hierarchy: ["AgentOS title", "Owned workspace management", "Connected five-stage provisioning journey", "Request identity beside live status"],
                density: ["Workspace rows remain scannable above one dense provisioning surface"], responsive: ["Lifecycle becomes an ordered vertical sequence on narrow screens"],
                visualPrecedent: "Nivo console topology with unicorn-red profile accent", sourceFeasibility: "passed",
            }],
            stateInventory: [{pageId: "agentos", states: ["agentos-ready", "catalog-loading", "request", "submitting", "awaiting-payment", "accepted", "preparing", "ready", "failed"], pageStates: ["agentos-ready"], conditions: ["Representative ready composition", "Catalog pending", "Request available", "Mutation pending", "Invoice required", "Order accepted", "Infrastructure preparing", "Workspace ready", "Provisioning failed"]}],
            renders: [
                {pageId: "agentos", stateId: "agentos-ready", viewportId: "desktop", regions: page.regions},
                {pageId: "agentos", stateId: "agentos-ready", viewportId: "mobile", regions: page.regions},
            ],
        },
        reason: "The complete AgentOS page intersects workspace management and provisioning business journeys with the existing source owners.",
    }
    const artifact = {...batch([candidate], {kind: "page", source: "screenshot"}), schema: 7}
    artifact.envelope.surface = "agentos"
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(candidate.renderContract, undefined)
    assert.equal(candidate.executionPrompt, undefined)
})

test("schema 7 refuses anatomy assembled before every page render intent is merged", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    candidate.synthesis.pageIntents[0].renderIntents.push({id: "legacy-section-cards", mustRender: "Legacy-backed reading sections remain distinct surfaces", evidence: ["legacy screenshot"]})
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must bind every page render intent exactly/)
})

test("schema 7 refuses a merge row without a contract-first region capability", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addPageSynthesis(candidate)
    candidate.synthesis.intersections[0].bindings[0].regionIds = ["invented-region"]
    const artifact = {...batch([candidate]), schema: 7}
    artifact.envelope.mode = "generate"
    artifact.envelope.stage = "pages"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /not owned by page|has no contract-first capability/)
})

test("schema 6 refuses a layout candidate with no render contract or execution prompt", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /requires complete implementation authority|requires the canonical execution prompt/)
})

test("schema 6 refuses incomplete viewport coverage and execution reinterpretation", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    candidate.renderContract.renders.pop()
    candidate.executionPrompt.reinterpretation = "allowed"
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /selected state lesson\/lesson-ready must cover viewport mobile|expected "forbidden"/)
})

test("schema 6 allows review evidence beyond the five-view default when distinct risks require it", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    const states = ["s1", "s2", "s3", "s4", "s5", "s6"]
    candidate.renderContract.pages[0].states = ["lesson-ready", ...states]
    candidate.renderContract.pages[0].regions[0].data.states = ["lesson-ready", ...states]
    candidate.renderContract.pages[0].regions[0].sourceOwnership = {
        stateOwner: "block",
        drawing: {component: "LessonContentBase", path: "src/components/blocks/LessonContent/component.tsx"},
        connected: {component: "LessonContent", path: "src/components/blocks/LessonContent/index.tsx"},
        compositorKind: "page",
        compositor: {component: "LessonPageBase", path: "src/components/pages/LessonPage/component.tsx"},
        entry: {component: "LessonPage", path: "src/components/pages/LessonPage/index.tsx"},
        parentUses: "connected-component",
    }
    candidate.renderContract.sourceBoundary.push("src/components/blocks/LessonContent/component.tsx", "src/components/blocks/LessonContent/index.tsx")
    candidate.executionPrompt.sourceBoundary = candidate.renderContract.sourceBoundary
    candidate.renderContract.renders = candidate.renderContract.viewports.flatMap((viewport) => ["lesson-ready", ...states].map((stateId) => ({
        pageId: "lesson", stateId, viewportId: viewport.id, regions: ["lesson-content"],
    })))
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.equal(result.status, 0, result.stderr)
})

test("schema 6 refuses a prompt whose identity or source boundary drifts", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    candidate.executionPrompt.renderContractId = "other-render"
    candidate.executionPrompt.sourceBoundary = ["src/other.tsx"]
    candidate.executionPrompt.instructions.reverse()
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must equal render contract id|must exactly equal|canonical ordered execution instructions/)
})

test("schema 6 requires an explicit ComponentBase to Page source ownership chain", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    delete candidate.renderContract.pages[0].regions[0].sourceOwnership
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /sourceOwnership/)
})

test("schema 6 refuses PageProps proxying a block state and a block drawing owned by PageBase", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    const page = candidate.renderContract.pages[0]
    const region = page.regions[0]
    page.states = ["lesson-ready", "lesson-loading"]
    region.data.states = ["lesson-ready", "lesson-loading"]
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const proxied = runArtifact(artifact)
    assert.notEqual(proxied.status, 0)
    assert.match(proxied.stderr, /local states lesson-loading require a block owner|PageProps, LayoutProps or OverlayProps may not proxy block state/)
    region.sourceOwnership.stateOwner = "block"
    const pageOwnedDrawing = runArtifact(artifact)
    assert.notEqual(pageOwnedDrawing.status, 0)
    assert.match(pageOwnedDrawing.stderr, /block ComponentBase drawing must be distinct from its PageBase, LayoutBase or OverlayBase compositor/)
})

test("schema 6 requires every ownership path in the exact boundary and PageBase to use a connected child", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    const ownership = candidate.renderContract.pages[0].regions[0].sourceOwnership
    ownership.drawing.path = "src/components/blocks/LessonContent/component.tsx"
    ownership.parentUses = "drawing-component"
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must be present in renderContract.sourceBoundary/)
    assert.match(result.stderr, /outer Base must compose the connected Component/)
})

test("schema 6 encodes and validates a cross-page Overview to Apps transition", () => {
    const candidate = pageCandidate("operations-flow", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    candidate.pages = [
        {id: "overview", route: "/", state: "overview-ready", nodes: [existingShell, {id: "overview-page", kind: "page", change: "proposed", parentId: "app-shell"}], regions: ["overview-content"]},
        {id: "apps", route: "/apps", state: "apps-ready", nodes: [existingShell, {id: "apps-page", kind: "page", change: "proposed", parentId: "app-shell"}], regions: ["apps-content"]},
    ]
    candidate.regions = [region("overview", "overview-content"), region("apps", "apps-content")]
    const sourceBoundary = ["src/components/pages/OverviewPage/component.tsx", "src/components/pages/OverviewPage/index.tsx", "src/components/pages/AppsPage/component.tsx", "src/components/pages/AppsPage/index.tsx"]
    const renderRegion = (id, owner, state) => ({
        id, owner, component: owner, contract: "content-panel", anatomy: ["title", "body"],
        data: {owner, source: `${owner} query`, mapping: ["runtime entity -> rendered row"], states: [state], previewContent: "representative-fixture", runtimeTruth: "source-owned"},
        sourceOwnership: {stateOwner: "page", drawing: {component: `${owner}Base`, path: `src/components/pages/${owner}/component.tsx`}, connected: {component: owner, path: `src/components/pages/${owner}/index.tsx`}, compositorKind: "page", compositor: {component: `${owner}Base`, path: `src/components/pages/${owner}/component.tsx`}, entry: {component: owner, path: `src/components/pages/${owner}/index.tsx`}, parentUses: "connected-component"},
        visual: {typography: ["page hierarchy"], controls: ["route action"], surface: ["content panel"], geometry: ["main region"]},
    })
    candidate.renderContract = {
        id: "operations-flow-render", candidateId: candidate.id, sourceBoundary,
        viewports: [{id: "desktop", width: 1440, height: 900}],
        pages: [
            {id: "overview", route: "/", states: ["overview-ready"], pageStates: ["overview-ready"], regions: [renderRegion("overview-content", "OverviewPage", "overview-ready")], transitions: [{id: "open-apps", fromPageId: "overview", fromStateId: "overview-ready", toPageId: "apps", toStateId: "apps-ready", trigger: "Activate Apps navigation", owner: "ConsoleNavigation"}]},
            {id: "apps", route: "/apps", states: ["apps-ready"], pageStates: ["apps-ready"], regions: [renderRegion("apps-content", "AppsPage", "apps-ready")], transitions: []},
        ],
        renders: [
            {pageId: "overview", stateId: "overview-ready", viewportId: "desktop", regions: ["overview-content"]},
            {pageId: "apps", stateId: "apps-ready", viewportId: "desktop", regions: ["apps-content"]},
        ],
    }
    candidate.executionPrompt = {candidateId: candidate.id, renderContractId: candidate.renderContract.id, sourceBoundary, implementationMode: "exact-render-contract", reinterpretation: "forbidden", proofMode: "same-state-same-viewport-parity", instructions: ["read-exact-render-contract", "implement-every-page-region-state-viewport-transition-obligation", "touch-only-source-boundary", "do-not-reinterpret-preview", "stop-if-obligation-is-unrepresentable", "prove-preview-source-same-state-same-viewport-with-zero-mismatches"]}
    const artifact = {...batch([candidate], {kind: "flow", source: "description"}), schema: 6}
    artifact.envelope.mode = "generate"
    assert.equal(runArtifact(artifact).status, 0)
    candidate.renderContract.pages[0].transitions[0].toStateId = "missing-state"
    const invalid = runArtifact(artifact)
    assert.notEqual(invalid.status, 0)
    assert.match(invalid.stderr, /to endpoint must name a declared render state/)
})

test("schema 6 refuses preview fixture values masquerading as runtime truth", () => {
    const candidate = pageCandidate("one", axes[0])
    delete candidate.direction
    delete candidate.citesPrecedent
    candidate.systemId = "starci-master"
    candidate.pageOverride = {deviations: []}
    addRenderContract(candidate)
    candidate.renderContract.pages[0].regions[0].data.runtimeTruth = "preview-owned"
    const artifact = {...batch([candidate]), schema: 6}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /expected "source-owned"/)
})

test("schema 5 refuses a candidate that silently omits MASTER", () => {
    const candidates = [axes[0]].map((axis, index) => {
        const candidate = pageCandidate(["one"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: []}
        return candidate
    })
    delete candidates[0].systemId
    const artifact = {...batch(candidates), schema: 5}
    artifact.envelope.mode = "generate"
    const result = runArtifact(artifact)
    assert.notEqual(result.status, 0)
})

test("schema 5 explicit brainstorm accepts 3-4 targeted alternatives without requiring an earlier baseline", () => {
    const candidates = axes.map((axis, index) => {
        const candidate = pageCandidate(["one", "two", "three"][index], axis)
        delete candidate.direction
        delete candidate.citesPrecedent
        candidate.systemId = "starci-master"
        candidate.pageOverride = {deviations: [{axis: "composition", from: "baseline", to: candidate.id, reason: "Owner explicitly requested alternatives for this composition axis."}]}
        return candidate
    })
    const artifact = {...batch(candidates), schema: 5}
    artifact.envelope.mode = "brainstorm"
    assert.equal(runArtifact(artifact).status, 0)
    artifact.envelope.baselineCandidateAt = "d".repeat(64)
    assert.equal(runArtifact(artifact).status, 0)
})

test("schema 5 generate accepts one complete long flow with every page and region", () => {
    const pageIds = ["discover", "configure", "review", "submit", "success"]
    const pages = pageIds.map((pageId) => ({
        id: pageId, route: `/flow/${pageId}`, state: `${pageId}-ready`,
        nodes: [existingShell, {id: `${pageId}-page`, kind: "page", change: "new", parentId: "app-shell"}],
        regions: [`${pageId}-content`],
    }))
    const candidate = {
        id: "complete-flow", systemId: "starci-master", pageOverride: {deviations: []},
        axes: axes[0], pages, regions: pages.map((page) => region(page.id, page.regions[0])),
        reason: "One complete start-to-end flow contains every page, transition owner and content region.",
    }
    const artifact = batch([candidate], {kind: "flow", source: "description"})
    artifact.schema = 5
    artifact.envelope.mode = "generate"
    assert.equal(runArtifact(artifact).status, 0)
})

test("grammar-locked token values must match an existing vocabulary declaration", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))
    for (const candidate of candidates) candidate.direction = { ...candidate.direction, lockedTokens: { "--accent": "rose" } }
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /vocabulary declarations differ from the grammar-locked value/)
})

test("schema 4 refuses an existing nested layout that drifts between choices", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis, index === 1 ? "c".repeat(64) : existingShell.sourceHash))
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /existing source-bound node differs/)
})

test("schema 4 refuses an existing node introduced in only one choice", () => {
    const candidates = axes.map((axis, index) => pageCandidate(["one", "two", "three"][index], axis))
    candidates[1].pages[0].nodes.push({
        id: "legacy-drawer", kind: "drawer", change: "existing", parentId: "app-shell",
        source: "src/components/legacy-drawer.tsx", sourceHash: "c".repeat(64),
    })
    const result = runArtifact(batch(candidates))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /introduced in only this choice/)
})

test("schema 4 requires 3-4 complete candidates when a flow renders three pages", () => {
    const makeFlow = (id, axis) => {
        const pages = ["create-order", "review-order", "order-success"].map((pageId) => ({
            id: pageId, route: `/orders/${pageId}`, state: `${pageId}-ready`,
            nodes: [existingShell, { id: `${pageId}-page`, kind: "page", change: "new", parentId: "app-shell" }],
            regions: [`${pageId}-content`],
        }))
        return {
            id, direction, axes: axis, citesPrecedent: id === "one" ? "none" : "course-page",
            pages, regions: pages.map((page) => region(page.id, page.regions[0])),
            reason: `Complete order flow candidate ${id}.`,
        }
    }
    const ranked = runArtifact(batch(axes.map((axis, index) => makeFlow(["one", "two", "three"][index], axis)), { kind: "flow", source: "description" }))
    assert.equal(ranked.status, 0, ranked.stderr)
    const one = runArtifact(batch([makeFlow("one", axes[0])], { kind: "flow", source: "description" }))
    assert.notEqual(one.status, 0)
    assert.match(one.stderr, /requires 3-4 complete page-set choices/)
})

test("frontend quality receipt accepts closed lenses and detector families with binding StarCi evidence", () => {
    const result = runArtifact(qualityReview("refactor", "lesson-page"), "brainstorms/frontend-quality/schema.json")
    assert.equal(result.status, 0, result.stderr)
})

test("frontend quality receipt refuses external advisory evidence presented as binding", () => {
    const receipt = qualityReview("refactor", "lesson-page")
    receipt.sources[0].kind = "external-advisory"
    const result = runArtifact(receipt, "brainstorms/frontend-quality/schema.json")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /external design intelligence is advisory|at least one routed authority/)
})

test("frontend quality receipt refuses duplicate lens coverage even when array length stays ten", () => {
    const receipt = qualityReview("refactor", "lesson-page")
    receipt.lenses[9] = {...receipt.lenses[0]}
    const result = runArtifact(receipt, "brainstorms/frontend-quality/schema.json")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /closed frontend-quality lens exactly once/)
})

const blockSourceBoundary = [
    "src/components/blocks/Criteria/component.tsx",
    "src/components/blocks/Criteria/index.tsx",
    "src/components/pages/LessonPage/component.tsx",
    "src/components/blocks/Criteria/component.spec.tsx",
]

const blockArtifact = () => ({
        schema: 3,
        envelope: {round: 1, project: "sample", region: "criteria", parentAt: digest, parentPageId: "lesson", mode: "audit", stage: "direction"},
        anatomies: [{
            id: "criteria",
            axes: {dataOwner: "parent", repetition: "repeats", weight: "populated", composition: "label-value"},
            citesPrecedent: "none",
            states: ["populated", "empty"],
            uiDirection: {
                summary: "Keep criteria comparable inside the unchanged complete parent",
                hierarchy: ["Criterion label precedes its stored value"],
                responsive: ["Rows retain their reading order when the parent narrows"],
                emphasis: ["The compared value remains the dominant fact"],
            },
            qualityReview: qualityReview("block", "criteria"),
            sourceOwners: [
                {role: "drawing", component: "CriteriaBase", path: blockSourceBoundary[0]},
                {role: "entry", component: "Criteria", path: blockSourceBoundary[1]},
                {role: "compositor", component: "LessonPageBase", path: blockSourceBoundary[2]},
                {role: "test", component: "CriteriaBase tests", path: blockSourceBoundary[3]},
            ],
            restingCount: 4,
            parts: [{
                name: "criterion-row",
                cites: {kind: "entry", verdict: "reuse", key: "content-panel"},
                whyMatch: "A name is read against one stored value on a shared baseline",
            }],
            reason: "Keep repeated criteria comparable without changing the parent page",
        }],
        audit: {verdict: "pass", findings: []},
    })

test("block schema 3 binds one target-matched quality review before HTML", () => {
    const artifact = blockArtifact()
    const result = runArtifact(artifact, "brainstorms/blocks/schema.json")
    assert.equal(result.status, 0, result.stderr)
})

test("block schema 3 states stage accepts a selected direction with bounded complete-page proof", () => {
    const artifact = blockArtifact()
    artifact.envelope.stage = "states"
    artifact.stateReview = {
        candidateId: "criteria",
        views: [{
            id: "criteria-empty",
            pageId: "lesson",
            visibleStates: ["empty"],
            viewports: ["desktop", "narrow"],
            completePage: true,
        }],
        sourceBoundary: blockSourceBoundary,
    }
    const result = runArtifact(artifact, "brainstorms/blocks/schema.json")
    assert.equal(result.status, 0, result.stderr)
})

test("block schema 3 state views must bind the parent page and reachable block states", () => {
    const artifact = blockArtifact()
    artifact.envelope.stage = "states"
    artifact.stateReview = {
        candidateId: "criteria",
        views: [{id: "invented-state", pageId: "another-page", visibleStates: ["invented"], viewports: ["desktop", "narrow"], completePage: true}],
        sourceBoundary: blockSourceBoundary,
    }
    const result = runArtifact(artifact, "brainstorms/blocks/schema.json")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /must equal bound parent page|unknown block states/)
})

test("block schema 3 source boundary must contain the proven owner and test chain", () => {
    const artifact = blockArtifact()
    artifact.envelope.stage = "states"
    artifact.stateReview = {
        candidateId: "criteria",
        views: [{id: "criteria-empty", pageId: "lesson", visibleStates: ["empty"], viewports: ["desktop", "narrow"], completePage: true}],
        sourceBoundary: ["src/unrelated.tsx"],
    }
    const result = runArtifact(artifact, "brainstorms/blocks/schema.json")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /missing drawing owner path|missing test owner path/)
})

test("block schema 3 allows state evidence beyond the five-view default", () => {
    const artifact = blockArtifact()
    artifact.envelope.stage = "states"
    artifact.stateReview = {
        candidateId: "criteria",
        views: Array.from({length: 6}, (_, index) => ({
            id: `criteria-state-${index + 1}`,
            pageId: "lesson",
            visibleStates: [index === 0 ? "empty" : "populated"],
            viewports: ["desktop", "narrow"],
            completePage: true,
        })),
        sourceBoundary: blockSourceBoundary,
    }
    const result = runArtifact(artifact, "brainstorms/blocks/schema.json")
    assert.equal(result.status, 0, result.stderr)
})
