/**
 * The rules that hold HFS errors and their handling (catalog R38 `BE_ERROR_HOME`, R40 `BE_LOGGER_REQUIRED`, R108
 * `BE_ERROR_CAUSE_DROPPED`).
 *
 * One habit: a failure is either named where its owner lives, or it is visible. Every question is answered by TYPE and by
 * the owner that declares the type (BE-CONVENTION 1.8, 3.1): no rule here matches a class, receiver or file by its name.
 *
 *   - `catch-must-account` refuses a `catch` (and a promise `.catch`) that swallows. A handler passes when it rethrows,
 *     returns an outcome carrying the caught error, or calls a method on a receiver typed `Logger` from `platform/logging`.
 *   - `replacement-throw-carries-cause` (R108 `BE_ERROR_CAUSE_DROPPED`) refuses a `throw` that escapes a `catch` (or a
 *     promise `.catch` handler) and neither rethrows the caught value nor carries it: the replacement capability error
 *     takes the exact caught value as `cause` (BE-ERROR-4). A value the rule cannot see through (a parameter, a call that
 *     is handed the caught value) counts as carrying, so a kept cause is never reported.
 *   - `error-home` keeps every error class where its owner is: a class that derives from `DomainError` is declared only in
 *     `errors/<capability>.error.ts` of its own owner, and a class that derives from the built-in `Error` some other way
 *     (`AbstractException`, a framework `HttpException` subclass, a bare `extends Error`) is refused.
 *   - `throw-domain-error` refuses a `throw` whose type does not derive from `DomainError` (`throw new Error`, the Nest
 *     `HttpException` family, a thrown string or object), and a domain owner that throws a platform error outward.
 *   - `error-family-shape` holds the one shape of `errors/<c>.error.ts`: a `<C>ErrorCode` string enum, a
 *     `<C>_ERROR_KINDS: Record<<C>ErrorCode, ErrorKind>` table, and an empty `<C>Error extends DomainError<<C>ErrorCode>`.
 *     Code uniqueness across the repository is the architecture machine's job, not a single file's.
 */
import { some, walk } from "./lib/ast.mjs"
import {
    derives,
    derivesFromBuiltinError,
    derivesFromDomainError,
    errorHomeOf,
    isOwnedBy,
    isOwnedType,
    ownerName,
    partsOf,
    typeOf,
} from "./lib/declared.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"
import { typed } from "./lib/types.mjs"

/** True when `name` is used as a value in `node` (not just as the object of `name.message`). */
const carriesCaught = (node, name) => {
    if (!name) return false
    let carried = false
    walk(node, (child) => {
        if (child.type !== "Identifier" || child.name !== name) return
        let inner = child
        while (inner.parent && (inner.parent.type === "TSAsExpression" || inner.parent.type === "TSNonNullExpression" || inner.parent.type === "TSTypeAssertion")) inner = inner.parent
        const parent = inner.parent
        if (parent?.type === "MemberExpression" && parent.object === inner) return
        carried = true
    })
    return carried
}

const paramName = (fn) => (fn.params?.[0]?.type === "Identifier" ? fn.params[0].name : null)

/** Every failure is rethrown, logged through the logger port, or returned as an outcome carrying its cause. */
export const catchMustAccount = {
    meta: {
        type: "problem",
        docs: { description: "A catch rethrows, calls a method on a `Logger` receiver, or returns an outcome that carries the cause." },
        schema: [],
        messages: {
            empty: "This `catch` is empty, so the failure vanishes. Rethrow it, log it through the `Logger` of `platform/logging`, or return a typed outcome carrying it as `cause`.",
            swallowed:
                "This `catch` neither rethrows, logs through the `Logger` of `platform/logging`, nor returns an outcome carrying the caught error, so the failure leaves no trace. Rethrow it, log it through the `Logger`, or return a typed outcome with `cause`.",
        },
    },
    create(context) {
        /** A call of a method on a receiver whose type is the `Logger` port declared by `platform/logging`. */
        const isLoggerCall = (node) =>
            node.type === "CallExpression" &&
            node.callee.type === "MemberExpression" &&
            isOwnedType(context, node.callee.object, "Logger", "platform", "logging")
        const accounts = (body, param) =>
            some(
                body,
                (node) =>
                    node.type === "ThrowStatement" ||
                    isLoggerCall(node) ||
                    (node.type === "ReturnStatement" && node.argument !== null && carriesCaught(node.argument, param)),
                { intoFunctions: false },
            )
        const checkBlock = (reportNode, body, param) => {
            if (body.body.length === 0) context.report({ node: reportNode, messageId: "empty" })
            else if (!accounts(body, param)) context.report({ node: reportNode, messageId: "swallowed" })
        }
        return {
            CatchClause(node) {
                checkBlock(node, node.body, node.param?.type === "Identifier" ? node.param.name : null)
            },
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression" || node.callee.computed) return
                if (node.callee.property.type !== "Identifier" || node.callee.property.name !== "catch") return
                const handler = node.arguments[0]
                if (!handler || (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression")) return
                if (handler.body.type === "BlockStatement") {
                    checkBlock(handler, handler.body, paramName(handler))
                } else if (!isLoggerCall(handler.body) && !carriesCaught(handler.body, paramName(handler))) {
                    context.report({ node: handler, messageId: "swallowed" })
                }
            },
        }
    },
}

/** The statements of a catch body that escape it: nested functions, nested handlers and guarded `try` blocks are not. */
const escapingThrows = (body) => {
    const found = []
    const visit = (node) => {
        if (!node || typeof node !== "object" || typeof node.type !== "string") return
        if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") return
        if (node.type === "CatchClause") return
        if (node.type === "ThrowStatement") found.push(node)
        if (node.type === "TryStatement") {
            // a throw of the guarded block lands in the nested handler, which is judged on its own
            if (!node.handler) visit(node.block)
            visit(node.finalizer)
            return
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === "parent" || key === "loc" || key === "range") continue
            if (Array.isArray(value)) value.forEach(visit)
            else visit(value)
        }
    }
    body.body.forEach(visit)
    return found
}

/** The variable `identifier` names at its position, or null. */
const variableOf = (sourceCode, identifier) => {
    for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name)
        if (variable) return variable
    }
    return null
}

/**
 * True when the thrown value carries the caught one: it is the caught binding, it uses it as a value, or it is a variable
 * whose initializer or an assignment uses it. Anything the rule cannot see through is taken as carrying, so it never
 * reports a throw that might keep the cause.
 */
const throwCarriesCaught = (sourceCode, argument, caught) => {
    if (carriesCaught(argument, caught)) return true
    let value = argument
    while (value.type === "TSAsExpression" || value.type === "TSNonNullExpression" || value.type === "TSTypeAssertion") value = value.expression
    if (value.type === "Identifier") {
        const variable = variableOf(sourceCode, value)
        // an unresolved global or an import cannot carry this catch's value, but a parameter may hold anything
        if (!variable) return false
        if (variable.defs.some((def) => def.type === "Parameter")) return true
        if (variable.defs.some((def) => def.node.type === "VariableDeclarator" && def.node.init && carriesCaught(def.node.init, caught))) return true
        return variable.references.some((reference) => reference.isWrite() && reference.writeExpr && carriesCaught(reference.writeExpr, caught))
    }
    return false
}

/** A catch that replaces the caught failure passes the caught value on as the replacement's `cause` (BE-ERROR-4). */
export const replacementThrowCarriesCause = {
    meta: {
        type: "problem",
        docs: { description: "A throw that escapes a catch rethrows the caught value or carries it (as `cause`) in the replacement." },
        schema: [],
        messages: {
            dropped:
                "This `throw` replaces the caught failure without carrying it, so the stack and the original error are lost. Pass the exact caught value as `cause` of the capability error (`new <C>Error({ code, cause: {{name}} })`) or rethrow it.",
            unbound:
                "This `throw` replaces a failure its `catch` never bound, so the original error is lost. Bind it (`catch (error)`) and pass it as `cause` of the capability error, or rethrow it.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()
        const check = (body, param) => {
            const caught = param?.type === "Identifier" ? param.name : null
            for (const statement of escapingThrows(body)) {
                const argument = statement.argument
                if (caught === null) {
                    context.report({ node: statement, messageId: "unbound" })
                    continue
                }
                if (throwCarriesCaught(sourceCode, argument, caught)) continue
                context.report({ node: statement, messageId: "dropped", data: { name: caught } })
            }
        }
        return {
            CatchClause(node) {
                // a destructured binding names parts of the failure, not the failure itself; the rule cannot tell which part is kept
                if (node.param && node.param.type !== "Identifier") return
                check(node.body, node.param)
            },
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression" || node.callee.computed) return
                if (node.callee.property.type !== "Identifier" || node.callee.property.name !== "catch") return
                const handler = node.arguments[0]
                if (!handler || (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression")) return
                if (handler.body.type !== "BlockStatement") return
                if (handler.params[0] && handler.params[0].type !== "Identifier") return
                check(handler.body, handler.params[0])
            },
        }
    },
}

/**
 * The test world (slot `be.tests.world`) is the TEST COMPOSITION ROOT and owns no capability folder: its one error class
 * `TestWorldError` lives in `test-world.error.ts` at the world root, which is the world's `errors/<capability>.error.ts`.
 * Only that file is a home; a nested `fakes/**` file, a spec and every other owner stay judged by `errors/<c>.error.ts`.
 */
const isWorldErrorHome = (hfs, filename) => {
    const placed = hfs.classify(filename)
    return placed.slot === "be.tests.world" && placed.path === `${placed.root}/test-world.error.ts`
}

/** True when a class of a unit spec (`<name>.spec.ts`) is local to it: neither exported by declaration nor by an `export { Name }` list. */
const isSpecLocalClass = (filename, node) => {
    if (!/\.spec\.[cm]?ts$/.test(filename) || !node.id) return false
    if (node.parent?.type === "ExportNamedDeclaration" || node.parent?.type === "ExportDefaultDeclaration") return false
    const program = node.parent?.type === "Program" ? node.parent : null
    if (!program) return node.type === "ClassDeclaration" || node.type === "ClassExpression"
    return !program.body.some((statement) => statement.type === "ExportNamedDeclaration" && !statement.source && statement.specifiers.some((specifier) => (specifier.local.name ?? specifier.local.value) === node.id.name))
}

/** An error class is declared at its owner in `errors/<capability>.error.ts` and derives from `DomainError`. */
export const errorHome = {
    meta: {
        type: "problem",
        docs: { description: "An error class derives from `DomainError` and is declared only in `errors/<capability>.error.ts` of its owner." },
        schema: [],
        messages: {
            place: "`{{name}}` derives from `DomainError` but is not declared in `errors/{{owner}}.error.ts` of its owner. An owner has one error class, in that file; move it there.",
            mustExtendDomainError:
                "`{{name}}` derives from the built-in `Error` without deriving from `DomainError` (`AbstractException`, a framework exception or a bare `extends Error`). Extend `DomainError` from `platform/errors` in the owner's `errors/<capability>.error.ts`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = normalizePath(context.filename)
        const check = (node) => {
            if (!node.id) return
            const type = typeOf(context, node.id)
            if (!type) return
            const isDomainErrorHost = node.id.name === "DomainError" && isOwnedBy(hfs, filename, "platform", "errors")
            if (isDomainErrorHost) return
            if (derivesFromDomainError(context, type)) {
                if (isWorldErrorHome(hfs, filename)) return
                // A spec-local subclass of the abstract base is a test double for code that takes any DomainError, not an error family.
                if (isSpecLocalClass(filename, node)) return
                const home = errorHomeOf(hfs, filename)
                const owner = ownerName(hfs.ownerOf(filename))
                if (!home || home.capability !== owner) context.report({ node: node.id, messageId: "place", data: { name: node.id.name, owner: owner ?? "<capability>" } })
            } else if (derivesFromBuiltinError(context, type)) {
                context.report({ node: node.id, messageId: "mustExtendDomainError", data: { name: node.id.name } })
            }
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

/** The variable a thrown identifier names is the parameter of a `catch` clause or of a promise `.catch` handler. */
const isCaughtValue = (context, identifier) => {
    for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name)
        if (!variable) continue
        return variable.defs.some((definition) => {
            if (definition.type === "CatchClause") return true
            if (definition.type !== "Parameter") return false
            const fn = definition.node
            const call = fn.parent
            return (
                (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") &&
                call?.type === "CallExpression" &&
                call.arguments[0] === fn &&
                call.callee.type === "MemberExpression" &&
                !call.callee.computed &&
                call.callee.property.type === "Identifier" &&
                call.callee.property.name === "catch" &&
                fn.params[0] === definition.name
            )
        })
    }
    return false
}

/** Every thrown value is a `DomainError` of the owner that throws it. */
export const throwDomainError = {
    meta: {
        type: "problem",
        docs: { description: "A thrown value's type derives from `DomainError`; a domain owner never throws a platform error outward." },
        schema: [],
        messages: {
            bareError: "`throw new Error(...)` carries a sentence and no code, so nothing downstream can group or map it. Throw the `<C>Error` of the owning capability with one of its codes.",
            framework: "`throw new {{name}}(...)` carries an HTTP status and no identity. Throw the `<C>Error` of the owning capability; the one filter of `platform/errors` maps its code to a status.",
            notDomainError: "This `throw` does not throw a `DomainError`. Throw the `<C>Error` of the owning capability with one of its codes, or return an `Outcome` and let the transport unwrap it.",
            platformThrown: "A domain owner throws `{{name}}`, an error of a platform owner. Translate it into the error of this capability so platform details do not cross the boundary.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = normalizePath(context.filename)
        const { checker } = typed(context)
        const isHttpException = (type) => derives(checker, type, (name, file) => name === "HttpException" && /\/node_modules\/@nestjs\/common\//.test(file))
        return {
            ThrowStatement(node) {
                const thrown = node.argument
                if (!thrown) return
                if (thrown.type === "Identifier" && isCaughtValue(context, thrown)) return
                const type = typeOf(context, thrown)
                const parts = partsOf(type)
                const foreign = parts.find((part) => !derivesFromDomainError(context, part))
                if (parts.length === 0 || foreign) {
                    if (foreign && isHttpException(foreign)) {
                        context.report({ node: thrown, messageId: "framework", data: { name: foreign.getSymbol()?.name ?? "HttpException" } })
                    } else if (foreign && derivesFromBuiltinError(context, foreign)) {
                        context.report({ node: thrown, messageId: "bareError" })
                    } else {
                        context.report({ node: thrown, messageId: "notDomainError" })
                    }
                    return
                }
                if (hfs.tierOf(filename) !== "domain") return
                for (const part of parts) {
                    const declarations = part.getSymbol()?.declarations ?? []
                    const platform = declarations.some((declaration) => hfs.tierOf(String(declaration.getSourceFile().fileName).replaceAll("\\", "/")) === "platform")
                    if (platform) {
                        context.report({ node: thrown, messageId: "platformThrown", data: { name: part.getSymbol().name } })
                        return
                    }
                }
            },
        }
    },
}

const words = (kebab) => kebab.split("-")
const pascal = (kebab) => words(kebab).map((word) => word[0].toUpperCase() + word.slice(1)).join("")
const upperSnake = (kebab) => words(kebab).join("_").toUpperCase()

/** The exported declaration inside an `export ...` statement, else null. */
const exportedDeclaration = (statement) => (statement.type === "ExportNamedDeclaration" ? statement.declaration : null)

/** The one shape of an owner's `errors/<capability>.error.ts`. */
export const errorFamilyShape = {
    meta: {
        type: "problem",
        docs: { description: "`errors/<c>.error.ts` exports one code enum, one `Record<Code, ErrorKind>` table and one empty error class." },
        schema: [],
        messages: {
            noCode: "This file must export `enum {{pascal}}ErrorCode` with one member per code of the capability.",
            extra: "`{{name}}` is an extra export. An error family file exports only `{{pascal}}ErrorCode`, `{{upper}}_ERROR_KINDS` and `{{pascal}}Error`.",
            memberValue: "`{{member}}` must be a string literal `{{upper}}_<WHAT>` in upper snake case with no `_EXCEPTION` or `_ERROR` suffix.",
            noKinds: "This file must export `const {{upper}}_ERROR_KINDS: Record<{{pascal}}ErrorCode, ErrorKind>` so the compiler proves every code has a kind.",
            kindsType: "`{{upper}}_ERROR_KINDS` must be annotated `Record<{{pascal}}ErrorCode, ErrorKind>` with `ErrorKind` from `platform/errors`; only that annotation makes the table exhaustive.",
            noClass: "This file must export `class {{pascal}}Error extends DomainError<{{pascal}}ErrorCode> {}`, the one error class of the capability.",
            classShape: "`{{pascal}}Error` must extend `DomainError<{{pascal}}ErrorCode>` from `platform/errors` and declare nothing beyond its JSDoc: no body, no per-case subclass.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const home = errorHomeOf(hfs, normalizePath(context.filename))
        if (!home) return {}
        const data = { pascal: pascal(home.capability), upper: upperSnake(home.capability) }
        const codeName = `${data.pascal}ErrorCode`
        const kindsName = `${data.upper}_ERROR_KINDS`
        const className = `${data.pascal}Error`
        return {
            Program(program) {
                const declared = program.body.map(exportedDeclaration).filter(Boolean)
                const enums = declared.filter((declaration) => declaration.type === "TSEnumDeclaration")
                const code = enums.find((declaration) => declaration.id.name === codeName)
                if (!code) context.report({ node: program, loc: { line: 1, column: 0 }, messageId: "noCode", data })
                else {
                    const prefix = new RegExp(`^${data.upper}_[A-Z0-9]+(?:_[A-Z0-9]+)*$`)
                    for (const member of code.body?.members ?? code.members) {
                        const value = member.initializer
                        const text = value?.type === "Literal" && typeof value.value === "string" ? value.value : null
                        if (text === null || !prefix.test(text) || /_(?:EXCEPTION|ERROR)$/.test(text)) {
                            context.report({ node: member, messageId: "memberValue", data: { ...data, member: member.id.name ?? member.id.value } })
                        }
                    }
                }
                const kinds = declared.find((declaration) => declaration.type === "VariableDeclaration" && declaration.declarations.some((d) => d.id.name === kindsName))
                if (!kinds) context.report({ node: program, loc: { line: 1, column: 0 }, messageId: "noKinds", data })
                else {
                    const declarator = kinds.declarations.find((d) => d.id.name === kindsName)
                    const annotation = declarator.id.typeAnnotation?.typeAnnotation
                    const args = annotation?.typeArguments?.params ?? annotation?.typeParameters?.params ?? []
                    const isRecord = annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier" && annotation.typeName.name === "Record"
                    const keyOk = args[0]?.type === "TSTypeReference" && args[0].typeName.type === "Identifier" && args[0].typeName.name === codeName
                    const valueOk = args.length === 2 && args[1].type === "TSTypeReference" && isOwnedType(context, args[1], "ErrorKind", "platform", "errors")
                    if (!isRecord || args.length !== 2 || !keyOk || !valueOk) context.report({ node: declarator.id, messageId: "kindsType", data })
                }
                const cls = declared.find((declaration) => declaration.type === "ClassDeclaration" && declaration.id?.name === className)
                if (!cls) context.report({ node: program, loc: { line: 1, column: 0 }, messageId: "noClass", data })
                else {
                    const parent = cls.superClass
                    const args = cls.superTypeArguments?.params ?? cls.superTypeParameters?.params ?? []
                    const parentOk = parent && isOwnedType(context, parent, "DomainError", "platform", "errors")
                    const argOk = args.length === 1 && args[0].type === "TSTypeReference" && args[0].typeName.type === "Identifier" && args[0].typeName.name === codeName
                    if (!parentOk || !argOk || cls.body.body.length > 0) context.report({ node: cls.id, messageId: "classShape", data })
                }
                for (const statement of program.body) {
                    const declaration = exportedDeclaration(statement)
                    const isExport = statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration" || statement.type === "ExportAllDeclaration"
                    if (!isExport) continue
                    const name =
                        declaration?.type === "VariableDeclaration"
                            ? declaration.declarations.map((d) => d.id.name).find((n) => n !== kindsName)
                            : declaration?.id?.name
                    if (declaration === null || declaration === undefined) {
                        context.report({ node: statement, messageId: "extra", data: { ...data, name: statement.type } })
                    } else if (name !== undefined && name !== codeName && name !== kindsName && name !== className) {
                        context.report({ node: declaration, messageId: "extra", data: { ...data, name } })
                    } else if (name === undefined && declaration.type !== "VariableDeclaration") {
                        context.report({ node: declaration, messageId: "extra", data: { ...data, name: declaration.type } })
                    }
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "catch-must-account": catchMustAccount,
    "replacement-throw-carries-cause": replacementThrowCarriesCause,
    "error-home": errorHome,
    "throw-domain-error": throwDomainError,
    "error-family-shape": errorFamilyShape,
}

/** All start at error: HFS has no baseline, and the migration lanes clear the debt before a repository adopts them. */
export const recommended = {
    "starci-be/catch-must-account": "error",
    "starci-be/replacement-throw-carries-cause": "error",
    "starci-be/error-home": "error",
    "starci-be/throw-domain-error": "error",
    "starci-be/error-family-shape": "error",
}
