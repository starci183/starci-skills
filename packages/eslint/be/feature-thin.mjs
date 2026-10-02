/**
 * The rule that holds the thin-feature law (R203 `BE_FEATURE_THIN`).
 *
 * A file of the feature tier whose role is one of `ruleParams.be.thinRoles` of the slot manifest
 * (`<name>.handler.ts`, `<name>.resolver.ts`, `<name>.consumer.ts`, `<name>.processor.ts`, `<name>.step.ts`,
 * `<name>.webhook.ts`, `<name>.mapper.ts`, ...) is a door: it maps its parameters and makes ONE delegating
 * call into the modules (a service, the command or query bus, the event bus, a queue producer). No branch,
 * loop, `try` or `throw` on business data and no computation lives in it - the logic belongs to the modules,
 * where every file is unit-covered at 100, and orchestration (step order, compensation, claim, fencing,
 * retry) belongs to the platform. A `mapper` file holds only property mapping: `*.mapper.ts` calls, `new`, and the shape conversions `map` and `toISOString`
 * expressions, no delegating call at all.
 *
 * Kind comes from the SLOT and the TIER (`hfs.tierOf(filename)`, `hfs.ruleParams.thinRoles`), the role from
 * the file-name suffix the closed role vocabulary defines - never a path regex. What a receiver is comes
 * from its TYPE (`Logger` of `platform/logging`, `WebhookSignatureService` of `platform/http-security`) and
 * from whether the member is injected (`injectedMembers`); what a free function is comes from the file its
 * import resolves to. A job `step` records its fence through `JobClaims` (`advance`, `runKey`) and a webhook proves its signature through `verify`: those gate calls
 * are free, the one effect each makes is the delegating call. `.spec.ts` and `.d.ts` are never judged, and neither is a file whose tier is not
 * `feature` or whose role is not a thin role. A clean thin file is never flagged: that is the bar.
 */
import { keyName, walk } from "./lib/ast.mjs"
import { aliasTarget, injectedMembers } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { importOf } from "./lib/import-source.mjs"
import { baseName, isLoggerType, isOwnedType } from "./lib/ports.mjs"

/** The statements and expressions that are a decision, a repetition or an exit: none lives in a thin file. */
const BRANCH_NODES = new Set(["IfStatement", "SwitchStatement", "ConditionalExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "TryStatement", "ThrowStatement", "LogicalExpression"])

/** The expressions that compute a value (a `TemplateLiteral` with an expression joins them). */
const COMPUTE_NODES = new Set(["BinaryExpression", "UnaryExpression", "UpdateExpression", "AssignmentExpression"])

/** The nodes a function can be: the walk for calls and the nesting test use the same set. */
const FUNCTION_NODES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "MethodDefinition"])

/** What one decision or loop node is called in a message. */
const BRANCH_WHAT = {
    IfStatement: "an `if`",
    SwitchStatement: "a `switch`",
    ConditionalExpression: "a ternary",
    ForStatement: "a `for`",
    ForInStatement: "a `for-in`",
    ForOfStatement: "a `for-of`",
    WhileStatement: "a `while`",
    DoWhileStatement: "a `do-while`",
    TryStatement: "a `try`",
    ThrowStatement: "a `throw`",
}

/** The wraps a call may sit under while still being the call of its statement. */
const STATEMENT_WRAPPERS = new Set(["AwaitExpression", "TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "ChainExpression"])

/** The closed-vocabulary role a file name carries (`<name>.<role>.ts` gives `<role>`), or null. */
const roleOf = (filename) => /\.([a-z][a-z0-9-]*)\.ts$/.exec(baseName(filename))?.[1] ?? null

/** The `WebhookSignatureService` of `platform/http-security` - the `verify` a webhook door may call. */
const isSignatureReceiver = (context, node) => isOwnedType(context, node, { name: "WebhookSignatureService", capability: "http-security", tier: "platform" })

/** The shape conversions a mapper may make on a value it received: a collection mapped item by item and a date written as text. They decide nothing and compute nothing. */
const MAPPER_SHAPE_METHODS = new Set(["map", "toISOString"])

/** The `JobClaims` port of `platform/jobs` - the fence a job step records itself through (`advance`, `runKey`): bookkeeping the fenced-job pattern requires, free beside the step's one delegating call. */
const isClaimsReceiver = (context, node) => isOwnedType(context, node, { name: "JobClaims", capability: "jobs", tier: "platform" })

/** The `Logger` port of `platform/logging` - the one call that is always free. */
const isLoggerReceiver = isLoggerType

/** The name of a thin file's law is `feature-thin` (R203). */
export const featureThin = {
    meta: {
        type: "problem",
        docs: { description: "A feature-tier file of a thin role maps its parameters and makes one delegating call into the modules: no branch, loop, `try`, `throw` or computation, and no call other than the one delegate, a modules function in mapping position, a `*.mapper.ts` function or the Logger." },
        schema: [],
        messages: {
            branch: "{{what}} is a decision or a repetition in a thin file. A feature `<name>.{{role}}.ts` maps its parameters and makes one delegating call into the modules; a branch, a loop, a `try` or a `throw` is business logic that belongs in a service of the modules (where a unit spec covers it) - and orchestration (step order, compensation, claim, fencing, retry) belongs to the platform.",
            compute: "{{what}} computes a value in a thin file. A feature `<name>.{{role}}.ts` maps its parameters and hands them over; an expression that computes is logic that belongs in the modules. Map the value there and read it back.",
            call: "`{{what}}` is a call a thin file does not make. It calls exactly one injected member (a service, a bus `execute`, an event bus, a queue producer) or one function of the modules, and pure `*.mapper.ts` functions and the `Logger` port are free{{webhook}}; everything else - parsing, mapping by hand, a helper, a second dependency - is logic that belongs in the modules.",
            many: "`{{name}}` makes a second delegating call here. A thin file makes exactly one; a second is orchestration - step order, compensation, claim, fencing, retry - and belongs to a capability of the platform or inside the service the file calls.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const name = baseName(context.filename)
        if (name.endsWith(".spec.ts") || name.endsWith(".d.ts")) return {}
        const role = roleOf(name)
        if (role === null || !(hfs.ruleParams.thinRoles ?? []).includes(role)) return {}
        if (hfs.tierOf(context.filename) !== "feature") return {}
        const sourceCode = context.sourceCode
        const mapperFile = role === "mapper"

        /** The injected member names of a class: constructor parameter properties and properties carrying an injector decorator. */
        const memberNames = new Map()
        const injectedNamesOf = (classNode) => {
            if (memberNames.has(classNode)) return memberNames.get(classNode)
            const names = new Set()
            for (const { node } of injectedMembers(context, classNode)) {
                if (node.type === "TSParameterProperty" && node.parameter.type === "Identifier") names.add(node.parameter.name)
                else if (node.type === "PropertyDefinition") {
                    const key = keyName(node.key)
                    if (key !== null) names.add(key)
                }
            }
            memberNames.set(classNode, names)
            return names
        }

        /**
         * The class `this` binds at a node's position: the nearest enclosing class, or null when a non-arrow
         * function or an object-literal method rebinds `this` in between (a method's own `FunctionExpression`
         * value is skipped - a method's `this` is the class).
         */
        const thisClassOf = (node) => {
            for (let parent = node.parent; parent; parent = parent.parent) {
                if (parent.type === "ClassDeclaration" || parent.type === "ClassExpression") return parent
                if (parent.type === "FunctionDeclaration") return null
                if (parent.type === "FunctionExpression" && parent.parent?.type !== "MethodDefinition") return null
            }
            return null
        }

        /** The member name of `this.<member>` the call's receiver names, when it is an injected member of the enclosing class. */
        const injectedMemberOf = (object, call) => {
            if (object.type !== "MemberExpression" || object.computed || object.object.type !== "ThisExpression" || object.property.type !== "Identifier") return null
            const classNode = thisClassOf(call)
            if (classNode === null) return null
            const member = object.property.name
            return injectedNamesOf(classNode).has(member) ? member : null
        }

        /** True for a call `f(...)` where `f` is imported from a `*.mapper.ts` (the pure mapping functions). */
        const isMapperCall = (callee) => {
            if (callee.type !== "Identifier") return false
            const found = importOf(context, callee)
            return found !== null && /(?:^|\/)[^/]+\.mapper(?:\.[cm]?[jt]s)?$/.test(found.source.replace(/\\/g, "/"))
        }

        /** True for a call `f(...)` where `f` is imported and its declaration lives outside the feature tier (a function of the modules). */
        const isModulesCall = (callee) => {
            if (callee.type !== "Identifier" || importOf(context, callee) === null) return false
            const symbol = aliasTarget(context, callee)
            return (symbol?.getDeclarations() ?? []).some((declaration) => hfs.tierOf(declaration.getSourceFile().fileName) !== "feature")
        }

        /** True when the call IS the statement it sits in: `f(...)`, `await f(...)`, `return (await) f(...)`, or the whole body of a concise arrow. */
        const isStatementCall = (call) => {
            let current = call
            while (STATEMENT_WRAPPERS.has(current.parent?.type)) current = current.parent
            const parent = current.parent
            return parent?.type === "ExpressionStatement" || parent?.type === "ReturnStatement" || (parent?.type === "ArrowFunctionExpression" && parent.body === current)
        }

        /**
         * What one call is to a thin file: `delegating` (the one call into the modules a file may make),
         * `free` (a mapper, a logger method, a webhook `verify`, a job step's `JobClaims` fence call, a modules function in a mapping position)
         * or `call` (a call a thin file does not make). A `mapper` file holds only mapper calls and `new`.
         */
        const classify = (call) => {
            const callee = call.callee
            if (callee.type === "Identifier" && isMapperCall(callee)) return "free"
            const member = callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee : null
            if (mapperFile && member !== null && MAPPER_SHAPE_METHODS.has(member.property.name) && injectedMemberOf(member.object, call) === null) return "free"
            // a cli group command shows its help without a sub-command: the `help` of the command nest-commander gives it
            if (role === "cli" && member !== null && member.property.name === "help" && member.object.type === "MemberExpression" && member.object.object.type === "ThisExpression" && member.object.property.type === "Identifier" && member.object.property.name === "command") return "free"
            if (mapperFile) return "call"
            if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && injectedMemberOf(callee.object, call) !== null) {
                if (isLoggerReceiver(context, callee.object)) return "free"
                if (role === "webhook" && callee.property.name === "verify" && isSignatureReceiver(context, callee.object)) return "free"
                if (role === "step" && isClaimsReceiver(context, callee.object)) return "free"
                return "delegating"
            }
            if (callee.type === "Identifier" && isModulesCall(callee)) return isStatementCall(call) ? "delegating" : "free"
            return "call"
        }

        /** Every root function of the file (a method body, function or arrow not nested in another function and not inside a decorator subtree). */
        const rootFunctionsOf = (program) => {
            const roots = []
            walk(program, (node) => {
                if (!FUNCTION_NODES.has(node.type)) return
                for (let parent = node.parent; parent; parent = parent.parent) {
                    if (parent.type === "Decorator" || FUNCTION_NODES.has(parent.type)) return
                }
                if (node.type === "MethodDefinition" && node.kind === "constructor") return
                roots.push(node)
            })
            return roots
        }

        /** The name a `many` message reports for a function root. */
        const nameOf = (fn) => {
            if (fn.type === "MethodDefinition") return keyName(fn.key) ?? "the method"
            if (fn.type === "FunctionDeclaration" && fn.id?.type === "Identifier") return fn.id.name
            const parent = fn.parent
            if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
            if ((parent?.type === "PropertyDefinition" || parent?.type === "Property") && keyName(parent.key)) return keyName(parent.key)
            return "the function"
        }

        const visitors = {}
        for (const type of BRANCH_NODES) {
            visitors[type] = (node) => context.report({ node, messageId: "branch", data: { what: type === "LogicalExpression" ? `a \`${node.operator}\`` : BRANCH_WHAT[type], role } })
        }
        for (const type of COMPUTE_NODES) {
            visitors[type] = (node) => context.report({ node, messageId: "compute", data: { what: `an \`${node.operator}\``, role } })
        }
        visitors.TemplateLiteral = (node) => {
            if (node.expressions.length > 0) context.report({ node, messageId: "compute", data: { what: "a template literal with an expression", role } })
        }
        visitors["Program:exit"] = (program) => {
            for (const root of rootFunctionsOf(program)) {
                const body = root.type === "MethodDefinition" ? root.value?.body : root.body
                if (!body) continue
                let delegating = 0
                walk(body, (node) => {
                    if (node.type !== "CallExpression") return
                    const kind = classify(node)
                    if (kind === "call") context.report({ node, messageId: "call", data: { what: sourceCode.getText(node.callee), webhook: role === "webhook" ? ", plus `verify` of the signature service" : "" } })
                    else if (kind === "delegating") {
                        delegating += 1
                        if (delegating === 2) context.report({ node, messageId: "many", data: { name: nameOf(root) } })
                    }
                })
            }
        }
        return visitors
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "feature-thin": featureThin,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/feature-thin": "error",
}
