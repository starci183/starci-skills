import assert from "node:assert/strict"
import test from "node:test"
import { functionalPreviewFailures, REQUIRED_CONDITION_FAMILIES } from "./functional-design-preview.mjs"

const states = [
    { id: "desktop-ready", viewport: { width: 1440, height: 900 } },
    { id: "mobile-drawer", viewport: { width: 390, height: 844 } },
]
const inventory = REQUIRED_CONDITION_FAMILIES.map((family) => ({
    family,
    applicability: ["viewport", "overlay", "interaction"].includes(family) ? "applicable" : "not-applicable",
    evidence: `${family} evidence`,
    values: family === "viewport" ? ["desktop", "mobile"] : family === "overlay" ? ["closed", "drawer-open"] : family === "interaction" ? ["open-drawer"] : [],
    stateIds: ["viewport", "overlay", "interaction"].includes(family) ? states.map((state) => state.id) : [],
}))
const design = {
    schemaVersion: 2,
    kind: "layout",
    functional: true,
    principleObligations: [{target: "course-shell", module: "flow", situation: "FLOW-CONTENT-1", reason: "The course task must read from navigation into content."}],
    states,
    contentMatrix: states.map((state) => ({stateId: state.id, entityKinds: ["course"], facts: ["Course progress and current module"], actions: ["Open drawer"], densityReason: "The state represents the owned course navigation surface."})),
    conditionInventory: inventory,
    transitions: [{ id: "open-drawer", from: "desktop-ready", action: "open-drawer", to: "mobile-drawer" }],
}
const preview = `<!doctype html><html data-functional-preview="true"><head><style>@media(max-width:700px){main{display:block}}</style><script>document.addEventListener("click",event=>{if(event.target.closest("[data-action]")) document.body.dataset.state="mobile-drawer"})</script></head><body><main data-business-state="desktop-ready"><button data-action="open-drawer">Open</button></main><aside data-business-state="mobile-drawer">Drawer</aside></body></html>`

test("accepts a self-contained functional condition and transition manifest", () => {
    assert.deepEqual(functionalPreviewFailures(design, preview), [])
})

test("refuses a render-only responsive document", () => {
    const failures = functionalPreviewFailures(design, "<!doctype html><style>@media(max-width:700px){}</style><main>Static</main>")
    assert.ok(failures.some((failure) => failure.includes("data-functional-preview")))
    assert.ok(failures.some((failure) => failure.includes("event-driven")))
    assert.ok(failures.some((failure) => failure.includes("no in-page data-action")))
})

test("refuses omitted UI condition families and network-backed previews", () => {
    const failures = functionalPreviewFailures({...design, conditionInventory: inventory.slice(0, 2)}, preview.replace("document.addEventListener", "fetch('/api');document.addEventListener"))
    assert.ok(failures.some((failure) => failure.includes("may not perform network")))
    assert.ok(failures.some((failure) => failure.includes("conditionInventory is missing")))
})

test("refuses a routed grammar without its accepted receipt", () => {
    const failures = functionalPreviewFailures({...design, grammar: "starci", grammarProfile: "starci-academy", grammarFacts: [], grammarDecisions: []}, preview)
    assert.ok(failures.some((failure) => failure.includes("requires grammarReceipt")))
})
