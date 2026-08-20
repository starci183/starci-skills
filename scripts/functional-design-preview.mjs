const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const REQUIRED_CONDITION_FAMILIES = ["viewport", "overlay", "disclosure", "async", "data", "permission", "interaction"]
const PRINCIPLE_MODULES = new Set(["alignment", "colour", "distribution", "divider", "flow", "gap", "grid", "overflow", "padding", "radius", "responsive", "size", "state", "surface-in-surface", "typography"])

const containsAttribute = (html, name, value) => new RegExp(`${name}\\s*=\\s*(?:"${value}"|'${value}')`, "i").test(html)

export function functionalPreviewFailures(design, html, label = "design preview", {requirePrinciples = true} = {}) {
    const failures = []
    const fail = (message) => failures.push(`${label}: ${message}`)
    if (design?.schemaVersion !== 2) {
        fail("current revisions require schemaVersion 2 functional proof")
        return failures
    }
    if (design.functional !== true) fail("design.json must declare functional: true")
    const obligations = Array.isArray(design.principleObligations) ? design.principleObligations : []
    const obligationKeys = new Set()
    if (requirePrinciples && !obligations.length) fail("design.json requires principleObligations from post-creative principles review")
    for (const obligation of obligations) {
        const key = `${obligation?.target}|${obligation?.module}|${obligation?.situation}`
        if (obligationKeys.has(key)) fail("principleObligations must be unique")
        obligationKeys.add(key)
        if (typeof obligation?.target !== "string" || !obligation.target.trim()) fail("principle obligation requires target")
        if (!PRINCIPLE_MODULES.has(obligation?.module)) fail(`${obligation?.target ?? "principle obligation"} uses an unknown principle module`)
        if (!/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]+$/.test(obligation?.situation ?? "")) fail(`${obligation?.target ?? "principle obligation"} requires a canonical situation id`)
        if (typeof obligation?.reason !== "string" || !obligation.reason.trim()) fail(`${obligation?.target ?? "principle obligation"} requires a business/visual reason`)
    }
    if (typeof html !== "string" || !html.trim()) {
        fail("preview.html is empty")
        return failures
    }
    if (!containsAttribute(html, "data-functional-preview", "true")) fail("preview.html lacks data-functional-preview=true")
    if (!/<script\b/i.test(html) || !/addEventListener\s*\(/.test(html)) fail("preview.html must execute event-driven product interactions")
    if (/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|navigator\.sendBeacon\s*\(/.test(html)) {
        fail("preview.html may not perform network or backend I/O")
    }

    const stateIds = new Set((design.states ?? []).map((state) => state?.id).filter(Boolean))
    const contentMatrix = Array.isArray(design.contentMatrix) ? design.contentMatrix : []
    const contentStates = new Set()
    for (const entry of contentMatrix) {
        if (!stateIds.has(entry?.stateId) || contentStates.has(entry?.stateId)) {
            fail("contentMatrix must cover each state exactly once")
            continue
        }
        contentStates.add(entry.stateId)
        if (!Array.isArray(entry?.entityKinds) || !entry.entityKinds.length || entry.entityKinds.some((value) => !SLUG.test(value ?? ""))) fail(`${entry.stateId} requires business entityKinds`)
        if (!Array.isArray(entry?.facts) || !entry.facts.length || entry.facts.some((value) => typeof value !== "string" || !value.trim())) fail(`${entry.stateId} requires representative business facts`)
        if (!Array.isArray(entry?.actions) || !entry.actions.length || entry.actions.some((value) => typeof value !== "string" || !value.trim())) fail(`${entry.stateId} requires representative business actions`)
        if (typeof entry?.densityReason !== "string" || !entry.densityReason.trim()) fail(`${entry.stateId} requires a density reason bound to business evidence`)
        if (!containsAttribute(html, "data-business-state", entry.stateId)) fail(`${entry.stateId} has no authored business-state rendering`)
    }
    for (const stateId of stateIds) if (!contentStates.has(stateId)) fail(`contentMatrix is missing ${stateId}`)
    if (/\blorem ipsum\b|\brough child\b|\bplaceholder (?:text|content|card)\b/i.test(html)) fail("preview.html contains placeholder or rough content")

    const inventory = Array.isArray(design.conditionInventory) ? design.conditionInventory : []
    const byFamily = new Map()
    for (const item of inventory) {
        if (!REQUIRED_CONDITION_FAMILIES.includes(item?.family) || byFamily.has(item.family)) {
            fail("conditionInventory families must be unique members of viewport|overlay|disclosure|async|data|permission|interaction")
            continue
        }
        byFamily.set(item.family, item)
        if (!['applicable', 'not-applicable'].includes(item?.applicability)) fail(`${item.family} requires applicability`)
        if (typeof item?.evidence !== "string" || !item.evidence.trim()) fail(`${item.family} requires evidence`)
        const values = Array.isArray(item?.values) ? item.values : []
        const covered = Array.isArray(item?.stateIds) ? item.stateIds : []
        if (item?.applicability === "applicable" && (!values.length || !covered.length)) fail(`${item.family} applicable coverage requires values and stateIds`)
        if (values.some((value) => !SLUG.test(value ?? ""))) fail(`${item.family} values must be slugs`)
        for (const stateId of covered) if (!stateIds.has(stateId)) fail(`${item.family} references absent state ${stateId}`)
    }
    for (const family of REQUIRED_CONDITION_FAMILIES) if (!byFamily.has(family)) fail(`conditionInventory is missing ${family}`)

    const transitions = Array.isArray(design.transitions) ? design.transitions : null
    if (!transitions) fail("design.json must declare transitions")
    if (design.kind === "layout" && transitions?.length === 0) fail("a functional layout requires at least one product transition")
    const seen = new Set()
    for (const transition of transitions ?? []) {
        if (!SLUG.test(transition?.id ?? "") || seen.has(transition.id)) fail("transition ids must be unique slugs")
        seen.add(transition?.id)
        if (!stateIds.has(transition?.from)) fail(`${transition?.id ?? "transition"} has absent from state`)
        if (!stateIds.has(transition?.to)) fail(`${transition?.id ?? "transition"} has absent to state`)
        if (!SLUG.test(transition?.action ?? "")) fail(`${transition?.id ?? "transition"} action must be a slug`)
        else if (!containsAttribute(html, "data-action", transition.action)) fail(`${transition.id} has no in-page data-action control`)
        else if (!new RegExp(`<(?:button|a)\\b[^>]*data-action\\s*=\\s*(?:"${transition.action}"|'${transition.action}')`, "i").test(html)) {
            fail(`${transition.id} action must be a native keyboard-operable button or link`)
        }
    }

    const viewport = byFamily.get("viewport")
    if (viewport?.applicability === "applicable" && viewport.values?.includes("mobile") && viewport.values?.includes("desktop") && !/@media\b/i.test(html)) {
        fail("desktop/mobile coverage requires actual responsive CSS")
    }
    return failures
}

export { PRINCIPLE_MODULES, REQUIRED_CONDITION_FAMILIES }
