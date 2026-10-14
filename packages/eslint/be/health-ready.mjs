/** R262: API health routes are wired and readiness checks a required dependency under a failing, bounded timeout. */
import fs from "node:fs"
import path from "node:path"
import tsParser from "@typescript-eslint/parser"
import { appRoleOf } from "./lib/app-roles.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorName, keyName, paramParts, staticText, walk } from "./lib/ast.mjs"

const unwrap = (node) => {
    while (["TSAsExpression", "TSNonNullExpression", "ChainExpression", "TSSatisfiesExpression"].includes(node?.type)) node = node.expression
    return node
}
const memberName = (node) => node?.computed ? staticText(node.property) : keyName(node?.property)
const typeName = (node) => node?.typeAnnotation?.typeAnnotation?.typeName?.name ?? null
const methodsOf = (node) => node.body.body.filter((entry) => entry.type === "MethodDefinition")
const classesOf = (program) => {
    const classes = new Map()
    walk(program, (node) => { if (node.type === "ClassDeclaration" && node.id) classes.set(node.id.name, node) })
    return classes
}
const bindingsOf = (program) => {
    const bindings = new Map()
    walk(program, (node) => { if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init) bindings.set(node.id.name, node.init) })
    return bindings
}

/** Expand local constants when proving a race: a timeout promise or duration may be held in a const. */
function expandedNodes(node, bindings, seen = new Set()) {
    const nodes = []
    walk(node, (child) => {
        nodes.push(child)
        if (child.type !== "Identifier" || seen.has(child.name) || !bindings.has(child.name)) return
        const next = new Set(seen).add(child.name)
        nodes.push(...expandedNodes(bindings.get(child.name), bindings, next))
    })
    return nodes
}

function sourcePath(source, filename, root) {
    const base = source.startsWith(".") ? path.resolve(path.dirname(filename), source)
        : source.startsWith("@modules/") ? path.join(root, "src/modules", source.slice(9))
        : source.startsWith("@features/") ? path.join(root, "src/features", source.slice(10)) : null
    if (!base || path.relative(root, base).startsWith("..")) return null
    return [base, `${base}.ts`, path.join(base, "index.ts")].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

function readProgram(filename) {
    try { return tsParser.parse(fs.readFileSync(filename, "utf8"), { sourceType: "module", ecmaVersion: "latest" }) } catch { return null }
}

const routesOf = (controller) => {
    const decorator = controller.decorators?.find((entry) => decoratorName(entry) === "Controller")
    if (!decorator) return []
    const prefix = staticText(decorator.expression.arguments?.[0]) ?? ""
    return methodsOf(controller).flatMap((method) => (method.decorators ?? []).filter((entry) => decoratorName(entry) === "Get").flatMap((entry) => {
        const arg = entry.expression.arguments?.[0]
        const paths = arg?.type === "ArrayExpression" ? arg.elements.map(staticText) : [staticText(arg) ?? ""]
        return paths.filter((route) => route !== null).map((route) => ({ route: `/${prefix}/${route}`.replace(/\/+/g, "/").replace(/\/$/, ""), method }))
    }))
}

function injectedOf(controller) {
    const constructor = methodsOf(controller).find((entry) => entry.kind === "constructor")
    return new Map((constructor?.value.params ?? []).map((param) => {
        const { target } = paramParts(param)
        return [target.name, typeName(target)]
    }).filter(([name]) => name))
}

const injectedCall = (node, injected) => {
    if (node.type !== "CallExpression" || unwrap(node.callee)?.type !== "MemberExpression") return null
    let owner = unwrap(node.callee.object)
    while (owner?.type === "CallExpression" && unwrap(owner.callee)?.type === "MemberExpression") owner = unwrap(owner.callee.object)
    while (owner?.type === "MemberExpression" && owner.object?.type !== "ThisExpression") owner = unwrap(owner.object)
    if (owner?.type !== "MemberExpression" || owner.object?.type !== "ThisExpression") return null
    const name = memberName(owner)
    if (!injected.has(name) || /(?:queryBus|commandBus|logger|liveness|liveProbe)/i.test(`${name} ${injected.get(name)}`)) return null
    return { name, method: memberName(unwrap(node.callee)), type: injected.get(name) }
}

function positiveDuration(node, bindings, seen = new Set()) {
    node = unwrap(node)
    if (node?.type === "Identifier" && bindings.has(node.name) && !seen.has(node.name)) return positiveDuration(bindings.get(node.name), bindings, new Set(seen).add(node.name))
    return node?.type === "Literal" && typeof node.value === "number" && Number.isFinite(node.value) && node.value > 0 && node.value <= 60000
}

function rejectingTimeout(nodes, bindings) {
    return nodes.some((node) => node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "setTimeout"
        && positiveDuration(node.arguments[1], bindings) && expandedNodes(node.arguments[0], bindings).some((entry) => entry.type === "CallExpression" && entry.callee.type === "Identifier" && entry.callee.name === "reject"))
}

function parentsOf(body) {
    const parents = new Map()
    walk(body, (node) => {
        for (const [key, value] of Object.entries(node)) {
            if (["parent", "loc", "range", "tokens", "comments"].includes(key)) continue
            for (const child of Array.isArray(value) ? value : [value]) if (child && typeof child.type === "string") parents.set(child, node)
        }
    })
    return parents
}

function consumedCall(node, body, bindings) {
    const parents = parentsOf(body)
    const nodes = []
    walk(body, (entry) => nodes.push(entry))
    return nodes.some((entry) => ["AwaitExpression", "ReturnStatement"].includes(entry.type)
        && expandedNodes(entry.argument, bindings).includes(node)
        && !expandedNodes(entry.argument, bindings).some((child) => child.type === "UnaryExpression" && child.operator === "void")
        && !["ArrowFunctionExpression", "FunctionExpression"].includes(parents.get(entry)?.type))
}

/** A required dependency failure must still make the readiness promise fail. */
function propagatesFailures(body) {
    const catches = []
    const promiseCatches = []
    walk(body, (node) => { if (node.type === "CatchClause") catches.push(node) })
    walk(body, (node) => { if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && memberName(node.callee) === "catch") promiseCatches.push(node.arguments[0]) })
    const rejected = (node) => node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.object.name === "Promise" && memberName(node.callee) === "reject"
    const fails = (block) => block?.body?.some((statement) => statement.type === "ThrowStatement" || statement.type === "ReturnStatement" && rejected(statement.argument))
    return catches.every((node) => node.body.body.some((statement) => statement.type === "ThrowStatement"
        || statement.type === "ReturnStatement" && statement.argument?.type === "CallExpression" && statement.argument.callee?.type === "MemberExpression"
            && statement.argument.callee.object.name === "Promise" && memberName(statement.argument.callee) === "reject"))
        && promiseCatches.every((callback) => callback && (rejected(callback.body) || fails(callback.body)))
}

function boundedDependency(method, injected, bindings) {
    if (!propagatesFailures(method.value.body)) return false
    const nodes = expandedNodes(method.value.body, bindings)
    return nodes.some((node) => {
        if (node.type !== "CallExpression" || !consumedCall(node, method.value.body, bindings)) return false
        const callee = unwrap(node.callee)
        if (callee?.type !== "MemberExpression") return false
        if (injectedCall(node, injected)) return expandedNodes(node, bindings).some((entry) => entry.type === "CallExpression"
            && entry.callee.type === "MemberExpression" && entry.callee.object.name === "AbortSignal" && memberName(entry.callee) === "timeout" && positiveDuration(entry.arguments[0], bindings))
        if (callee.object.name !== "Promise" || memberName(callee) !== "race") return false
        const racers = expandedNodes(node.arguments[0], bindings)
        return racers.some((entry) => injectedCall(entry, injected)) && rejectingTimeout(racers, bindings)
    })
}

function classInSource(name, program, filename, root, seen = new Set()) {
    const identity = `${filename}:${name}`
    if (seen.has(identity)) return null
    const next = new Set(seen).add(identity)
    const local = classesOf(program).get(name)
    if (local) return { controller: local, program, filename }
    for (const entry of program.body.filter((node) => ["ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source)) {
        const specifier = entry.specifiers?.find((node) => keyName(node.exported) === name)
        if (entry.type !== "ExportAllDeclaration" && !specifier) continue
        const target = sourcePath(entry.source.value, filename, root)
        const imported = target && readProgram(target)
        const controller = imported && classInSource(keyName(specifier?.local) ?? name, imported, target, root, next)
        if (controller) return controller
    }
    return null
}

function delegatedClass(name, program, filename, root) {
    const local = classInSource(name, program, filename, root)
    if (local) return local
    for (const entry of program.body.filter((node) => node.type === "ImportDeclaration")) {
        const specifier = entry.specifiers.find((node) => node.local.name === name)
        if (!specifier) continue
        const target = sourcePath(entry.source.value, filename, root)
        const imported = target && readProgram(target)
        const controller = imported && classInSource(specifier.imported?.name ?? name, imported, target, root)
        if (controller) return controller
    }
    return null
}

function realReadiness(controller, method, program, filename, root, visited = new Set()) {
    const identity = `${filename}:${controller.id.name}:${keyName(method.key)}`
    if (visited.has(identity)) return false
    const next = new Set(visited).add(identity)
    const injected = injectedOf(controller)
    if (boundedDependency(method, injected, bindingsOf(program))) return true
    if (!propagatesFailures(method.value.body)) return false
    const calls = expandedNodes(method.value.body, bindingsOf(program)).filter((node) => consumedCall(node, method.value.body, bindingsOf(program))).map((node) => injectedCall(node, injected)).filter(Boolean)
    return calls.some((call) => {
        const target = call.type && delegatedClass(call.type, program, filename, root)
        const delegated = target && methodsOf(target.controller).find((entry) => keyName(entry.key) === call.method)
        return delegated && realReadiness(target.controller, delegated, target.program, target.filename, root, next)
    })
}

/** Readiness delegation is proved through the injected service; the HTTP controller remains a thin door. */
export const readyReal = {
    meta: {
        type: "problem",
        docs: { description: "BE_READY_REAL: readiness probes an injected required dependency and fails under a bounded timeout." },
        schema: [],
        messages: { real: "BE_READY_REAL: this readiness route must probe an injected required dependency with a failing, bounded timeout; a liveness query or an unconditional success is not readiness." },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (hfs.slotOf(filename) !== "be.transport.http") return {}
        return {
            "Program:exit"(program) {
                for (const controller of classesOf(program).values()) for (const { route, method } of routesOf(controller)) {
                    if (!/(?:\/health\/ready|\/readyz)$/.test(route)) continue
                    if (!realReadiness(controller, method, program, filename, hfs.repoRoot)) context.report({ node: method, messageId: "real" })
                }
            },
        }
    },
}

/** Follow the app's local import closure; unused imports do not install a health transport. */
function wiringNames(program, wanted) {
    const used = new Set()
    const bindings = bindingsOf(program)
    const collect = (node) => { for (const entry of expandedNodes(node, bindings)) if (entry.type === "Identifier") used.add(entry.name) }
    const moduleObject = (node) => {
        if (node?.type !== "ObjectExpression") return
        for (const property of node.properties) if (["imports", "controllers"].includes(keyName(property.key))) collect(property.value)
    }
    for (const controller of classesOf(program).values()) {
        if (wanted && !wanted.includes(controller.id.name)) continue
        const module = controller.decorators?.find((entry) => decoratorName(entry) === "Module")
        moduleObject(module?.expression.arguments?.[0])
        for (const method of methodsOf(controller).filter((entry) => entry.static)) walk(method.value.body, (node) => {
            if (node.type === "ReturnStatement" && node.argument?.type === "ObjectExpression" && node.argument.properties.some((entry) => keyName(entry.key) === "module")) moduleObject(node.argument)
        })
    }
    walk(program, (node) => {
        if (node.type === "VariableDeclarator" && wanted?.includes(node.id.name)) collect(node.init)
        if (node.type === "FunctionDeclaration" && wanted?.includes(node.id?.name)) collect(node.body)
        if (node.type === "ExportNamedDeclaration" && !node.source) for (const specifier of node.specifiers) if (!wanted || wanted.includes(keyName(specifier.exported))) used.add(keyName(specifier.local))
    })
    return used
}

function appRoutes(filename, root) {
    const routes = new Set()
    const pending = [{ filename, wanted: ["AppModule"] }]
    const visited = new Set()
    while (pending.length) {
        const { filename: current, wanted } = pending.pop()
        const identity = `${current}:${wanted?.join(",") ?? "*"}`
        if (visited.has(identity)) continue
        visited.add(identity)
        const program = readProgram(current)
        if (!program) continue
        const used = wiringNames(program, wanted)
        for (const controller of classesOf(program).values()) if (!wanted || wanted.includes(controller.id.name) || used.has(controller.id.name)) for (const { route } of routesOf(controller)) routes.add(route)
        for (const entry of program.body.filter((node) => node.type === "ImportDeclaration")) {
            if (entry.importKind === "type" || !entry.specifiers.some((specifier) => used.has(specifier.local.name))) continue
            const target = sourcePath(entry.source.value, current, root)
            const imported = entry.specifiers.filter((specifier) => used.has(specifier.local.name)).map((specifier) => keyName(specifier.imported) ?? specifier.local.name)
            if (target) pending.push({ filename: target, wanted: imported })
        }
        for (const entry of program.body.filter((node) => ["ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type) && node.source && node.exportKind !== "type")) {
            const target = sourcePath(entry.source.value, current, root)
            const exported = entry.type === "ExportAllDeclaration" ? wanted : entry.specifiers.filter((specifier) => !wanted || wanted.includes(keyName(specifier.exported))).map((specifier) => keyName(specifier.local))
            if (target && (!exported || exported.length)) pending.push({ filename: target, wanted: exported })
        }
    }
    return routes
}

/** Each declared API composition exposes both process-local liveness and required-dependency readiness. */
export const healthSignals = {
    meta: {
        type: "problem",
        docs: { description: "BE_HEALTH_SIGNALS: every API app exposes /health/live and /health/ready." },
        schema: [],
        messages: { signals: "BE_HEALTH_SIGNALS: API {{app}} must register both /health/live and /health/ready in its module composition (missing {{missing}})." },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (appRoleOf(hfs, filename)?.entry !== "main.ts") return {}
        const app = hfs.apps.find((entry) => entry.name === hfs.classify(filename).bindings?.app)
        if (app?.kind !== "api") return {}
        return {
            "Program:exit"(node) {
                const routes = appRoutes(path.join(path.dirname(filename), "app.module.ts"), hfs.repoRoot)
                const missing = ["/health/live", "/health/ready"].filter((route) => !routes.has(route))
                if (missing.length) context.report({ node, messageId: "signals", data: { app: app.name, missing: missing.join(", ") } })
            },
        }
    },
}

export const rules = { "ready-real": readyReal, "health-signals": healthSignals }
export const recommended = { "starci-be/ready-real": "error", "starci-be/health-signals": "error" }
