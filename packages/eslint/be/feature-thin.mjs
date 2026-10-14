/**
 * The rules that hold the thin-feature law (R203 `BE_FEATURE_THIN`) and close the support-role escape
 * (R264 `HFS_FEATURE_LOGIC_ROLE`).
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
 * import resolves to. A job `step` records its fence through `JobClaims` (`advance`, `runKey`), and a webhook proves its signature through the shared `verify`
 * or a declared domain verifier as its first call: a separate gate call is free beside the one intake delegation.
 * A combined domain proof and intake counts as the delegation. `.spec.ts` and `.d.ts` are never judged, and neither is a file whose tier is not
 * `feature` or whose role is not a thin role. A clean thin file is never flagged: that is the bar.
 */
import { keyName, walk } from "./lib/ast.mjs"
import { aliasTarget, callsOf, decoratorsFrom, injectedMembers } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { importOf, isImportedFrom } from "./lib/import-source.mjs"
import { baseName, isLoggerType, isOwnedType } from "./lib/ports.mjs"
import { firstWebhookVerification, isWebhookDomainServiceType } from "./lib/webhook-verifiers.mjs"
import { isWebhookForbiddenReceiver } from "./lib/webhook-handoff.mjs"
import { isProviderAcknowledgement } from "./lib/webhook-ack.mjs"

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

/** A direct, non-computed member call; other callee shapes keep their ordinary call classification. */
const memberOf = (callee) => callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee : null

/** Nest-commander's group help is transport bookkeeping in a CLI door. */
const isCliHelp = (role, member) => role === "cli" && member?.property.name === "help" && member.object.type === "MemberExpression"
    && member.object.object.type === "ThisExpression" && member.object.property.type === "Identifier" && member.object.property.name === "command"

/** A signed number inside the validated immutable provider literal is data, rather than door computation. */
const isLiteralAcknowledgementInitializer = (context, hfs, node) => {
    let child = node
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === "VariableDeclarator") return parent.init === child && isProviderAcknowledgement(context, hfs, parent.id)
        child = parent
    }
    return false
}

/** A signed numeric literal in a TypeScript type annotation executes no expression. */
const isSignedNumericLiteralType = (node) => node.type === "UnaryExpression" && node.parent?.type === "TSLiteralType"
    && ["+", "-"].includes(node.operator) && node.argument.type === "Literal" && typeof node.argument.value === "number"

/** The name of a thin file's law is `feature-thin` (R203). */
export const featureThin = {
    meta: {
        type: "problem",
        docs: { description: "A feature-tier file of a thin role maps its parameters and makes one delegating call into the modules: no branch, loop, `try`, `throw` or computation, and no call other than the one delegate, a modules function in mapping position, a `*.mapper.ts` function or the Logger." },
        schema: [],
        messages: {
            branch: "{{what}} is a decision or a repetition in a thin file. A feature `<name>.{{role}}.ts` maps its parameters and makes one delegating call into the modules; a branch, a loop, a `try` or a `throw` is business logic that belongs in a service of the modules (where a unit spec covers it) - and orchestration (step order, compensation, claim, fencing, retry) belongs to the platform.",
            compute: "{{what}} computes a value in a thin file. A feature `<name>.{{role}}.ts` maps its parameters and hands them over; an expression that computes is logic that belongs in the modules. Map the value there and read it back.",
            call: "`{{what}}` is a call a thin file does not make. It calls exactly one injected member (a service, a bus `execute`, an event bus, a queue producer) or one function of the modules, and pure `*.mapper.ts` functions and the `Logger` port are free{{webhook}}; a webhook hands off through domain intake and the inbox/outbox, never a command/query bus or a feature handler. Everything else - parsing, mapping by hand, a helper, a second dependency - is logic that belongs in the modules.",
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
        const webhookDoor = role === "webhook" && hfs.slotOf(context.filename) === "be.feature.webhooks.http"

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
        const classifyMapperOrCli = (member, call) => {
            if (mapperFile && member !== null && MAPPER_SHAPE_METHODS.has(member.property.name) && injectedMemberOf(member.object, call) === null) return "free"
            if (isCliHelp(role, member)) return "free"
            return mapperFile ? "call" : null
        }

        /** The free bookkeeping calls beside an injected member's one delegate. */
        const classifyInjected = (member) => {
            if (webhookDoor && isWebhookForbiddenReceiver(context, hfs, member.object)) return "call"
            if (isLoggerReceiver(context, member.object)) return "free"
            if (role === "webhook" && member.property.name === "verify" && isSignatureReceiver(context, member.object)) return "free"
            if (role === "step" && isClaimsReceiver(context, member.object)) return "free"
            return "delegating"
        }

        const classify = (call) => {
            const callee = call.callee
            if (callee.type === "Identifier" && isMapperCall(callee)) return "free"
            const member = memberOf(callee)
            const special = classifyMapperOrCli(member, call)
            if (special !== null) return special
            if (member !== null && injectedMemberOf(member.object, call) !== null) return classifyInjected(member)
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
            visitors[type] = (node) => {
                if (isSignedNumericLiteralType(node)) return
                if (webhookDoor && isLiteralAcknowledgementInitializer(context, hfs, node)) return
                context.report({ node, messageId: "compute", data: { what: `an \`${node.operator}\``, role } })
            }
        }
        visitors.TemplateLiteral = (node) => {
            if (node.expressions.length > 0) context.report({ node, messageId: "compute", data: { what: "a template literal with an expression", role } })
        }
        visitors["Program:exit"] = (program) => {
            for (const root of rootFunctionsOf(program)) {
                const body = root.type === "MethodDefinition" ? root.value?.body : root.body
                if (!body) continue
                const proof = role === "webhook" && hfs.slotOf(context.filename) === "be.feature.webhooks.http" && root.type === "MethodDefinition" && decoratorsFrom(context, root, "@nestjs/common", "Post").length > 0
                    ? firstWebhookVerification(context, hfs, root) : null
                const separateDomainProof = proof !== null && callsOf(root).filter(({ receiver }) => receiver !== null && isWebhookDomainServiceType(context, hfs, receiver)).length > 1
                let delegating = 0
                walk(body, (node) => {
                    if (node.type !== "CallExpression") return
                    const classified = classify(node)
                    const kind = separateDomainProof && node === proof && classified === "delegating" ? "free" : classified
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

/** A declaration's signed numeric literal is still data, including an enum member or a constant. */
const isSignedNumericLiteral = (node) => node.type === "UnaryExpression" && ["+", "-"].includes(node.operator)
    && node.argument.type === "Literal" && typeof node.argument.value === "number"

/** A DTO's decorator application declares metadata; calls inside its arguments remain ordinary executable calls. */
const isDecoratorApplication = (node) => node.parent?.type === "Decorator" && node.parent.expression === node

/** A Nest command/query constructor initializes its data base through the required, argument-free super call. */
const isCqrsDataConstructor = (context, node) => {
    if (node.callee.type !== "Super" || node.arguments.length !== 0) return false
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === "MethodDefinition") {
            const declaration = parent.parent?.parent
            return parent.kind === "constructor" && isImportedFrom(context, declaration?.superClass, "@nestjs/cqrs", ["Command", "Query"])
        }
        if (["FunctionDeclaration", "ArrowFunctionExpression"].includes(parent.type)) return false
    }
    return false
}

/** Non-door feature roles declare data; renaming a policy or a guard must never hide business logic from R203. */
export const featureLogicRole = {
    meta: {
        type: "problem",
        docs: { description: "Non-door roles in the feature tier may declare data, types and DTO metadata, but cannot hold decisions, computation or executable calls." },
        schema: [],
        messages: {
            logic: "[HFS_FEATURE_LOGIC_ROLE] {{what}} puts executable logic in a feature `<name>.{{role}}.ts` support or data file. Keep its declarations and data here; put business logic in the tested modules and delegate through a declared thin feature role.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const name = baseName(context.filename)
        if (name.endsWith(".spec.ts") || name.endsWith(".d.ts")) return {}
        const role = roleOf(name)
        if (role === null || (hfs.ruleParams.thinRoles ?? []).includes(role)) return {}
        if (hfs.tierOf(context.filename) !== "feature") return {}
        // The feature's Nest composition is governed by the module laws. A module suffix in support/ is still support.
        if (["module", "module-definition"].includes(role) && hfs.slotOf(context.filename) !== "be.feature.application.support") return {}

        const report = (node, what) => context.report({ node, messageId: "logic", data: { what, role } })
        const visitors = {}
        for (const type of BRANCH_NODES) {
            visitors[type] = (node) => report(node, type === "LogicalExpression" ? `a \`${node.operator}\`` : BRANCH_WHAT[type])
        }
        for (const type of COMPUTE_NODES) {
            visitors[type] = (node) => {
                if (!isSignedNumericLiteral(node)) report(node, `an \`${node.operator}\``)
            }
        }
        visitors.TemplateLiteral = (node) => {
            if (node.expressions.length > 0) report(node, "a template literal with an expression")
        }
        visitors.CallExpression = (node) => {
            if (!isDecoratorApplication(node) && !isCqrsDataConstructor(context, node)) report(node, `the call \`${context.sourceCode.getText(node.callee)}\``)
        }
        visitors.TaggedTemplateExpression = (node) => report(node, `the tagged call \`${context.sourceCode.getText(node.tag)}\``)
        visitors.NewExpression = (node) => report(node, `the construction \`${context.sourceCode.getText(node.callee)}\``)
        return visitors
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "feature-thin": featureThin,
    "feature-logic-role": featureLogicRole,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/feature-thin": "error",
    "starci-be/feature-logic-role": "error",
}
