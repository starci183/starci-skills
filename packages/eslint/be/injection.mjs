/**
 * The rules that hold dependency injection (catalog R85 `BE_RAW_INJECT`, BE-CONVENTION 1.3).
 *
 * Every injected infrastructure dependency arrives through a zero-argument `Inject<Thing>()` decorator exported from
 * its owner's `<name>.decorators.ts`, built with `injector<T>(token)` over a `unique symbol` token:
 *
 *   - `injector-only`: `Inject(`, `InjectEntityManager(`, `InjectDataSource(`, `InjectQueue(`, `InjectRepository(` and
 *     any function whose name starts with `Inject` that a PACKAGE declares are called only in a `*.decorators.ts` at an
 *     owner root; a raw `@Inject(...)` decorator is a finding everywhere, and an injector decorates constructor
 *     parameters only (a property or method parameter is a finding).
 *   - `injector-shape`: in `*.decorators.ts` every `Inject<Thing>` is a zero-parameter function typed
 *     `TypedParameterDecorator<T>` whose body is `injector<T>(token)`, documented with JSDoc naming `T`; an exported
 *     token is `unique symbol = Symbol("<owner>.<thing>")`; `provide:` is a class or a `unique symbol`.
 *   - `injector-type-match`: the `T` of the injector on a constructor parameter is the parameter's annotated type.
 *   - `infra-needs-injector`: a constructor parameter typed by a platform/integrations declaration or by a package
 *     carries an `Inject<Thing>()` decorator; only domain services and types of the same owner are class-injected.
 *   - `no-module-ref`, `no-forward-ref`: no service locator, no cycle-hiding trick.
 *   - `no-string-token`: a token is a class or a `unique symbol`, never a string.
 *
 * Callees are identified by where the called function is DECLARED (the checker's resolved signature), so a renamed
 * import, a namespace import and an alias all resolve to the same function. A lookalike (`InjectFoo` declared in the
 * repository) is a custom injector and is judged by its shape, not by its name. Nothing here reads a variable name:
 * `Inject*` names are the convention's fixed vocabulary, not a receiver guess.
 */
import { posix } from "node:path"
import ts from "typescript"
import { staticText } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"
import { isPackageExport, typed, typeOrigins } from "./lib/types.mjs"

/** The raw decorators of Nest and TypeORM whose call is the injector's job. */
const RAW_NAMES = new Set(["Inject", "InjectEntityManager", "InjectDataSource", "InjectQueue", "InjectRepository"])

/** The package a declaration file belongs to (the innermost `node_modules/<pkg>`), else null; the compiler's own lib files are not packages. */
const packageOfFile = (file) => {
    if (/\/node_modules\/typescript\/lib\//.test(file)) return null
    const match = /^.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file)
    return match ? match[1] : null
}

/** The name a declaration is known by: its own name, or the variable an arrow/function expression is assigned to. */
const declarationName = (declaration) => {
    if (declaration.name && ts.isIdentifier(declaration.name)) return declaration.name.text
    const parent = declaration.parent
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
    return null
}

/** The variable a name resolves to from a node's scope. */
const variableOf = (context, node, name) => {
    for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(name)
        if (variable) return variable
    }
    return null
}

/** The import a callee identifier or namespace member comes from, read from syntax when the checker cannot resolve it. */
const importedCallee = (context, callee) => {
    const identifier = callee.type === "MemberExpression" && callee.object.type === "Identifier" ? callee.object : callee
    if (identifier.type !== "Identifier") return { name: null, module: null, file: null, ambient: false }
    const variable = variableOf(context, identifier, identifier.name)
    const def = variable?.defs.find((entry) => entry.type === "ImportBinding")
    if (!def) {
        const local = (variable?.defs.length ?? 0) > 0
        const name = callee.type === "MemberExpression" ? staticPropertyName(callee) : identifier.name
        return { name, module: null, file: null, ambient: !local }
    }
    const source = String(def.parent.source.value)
    const specifier = def.node
    const name = specifier.type === "ImportSpecifier"
        ? (specifier.imported.name ?? specifier.imported.value)
        : callee.type === "MemberExpression" ? staticPropertyName(callee) : "default"
    return { name, module: source.startsWith(".") ? null : source, file: null, ambient: false }
}

/** The property a member expression names (`common.Inject` -> `Inject`), else null. */
const staticPropertyName = (member) => {
    if (member.computed) return staticText(member.property)
    return member.property.type === "Identifier" ? member.property.name : null
}

/**
 * Where the function a call invokes (or a decorator names) is declared.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - A CallExpression, or an Identifier used as a bare decorator.
 * @returns {{ name: string | null, file: string | null, module: string | null, ambient: boolean }} The declaration's name, file and package; `ambient` is true for a name nothing declares.
 */
const calleeOf = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    let declaration
    if (tsNode && ts.isCallExpression(tsNode)) declaration = checker.getResolvedSignature(tsNode)?.declaration
    else if (tsNode) {
        let symbol = checker.getSymbolAtLocation(tsNode)
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
        declaration = symbol?.getDeclarations?.()?.[0]
    }
    if (declaration?.getSourceFile()) {
        const file = normalizePath(declaration.getSourceFile().fileName)
        return { name: declarationName(declaration), file, module: packageOfFile(file), ambient: false }
    }
    return importedCallee(context, node.type === "CallExpression" ? node.callee : node)
}

/** The convention's injector vocabulary: `Inject` or `Inject<Thing>`; `Injectable` and other lower-case continuations are not injectors. */
const INJECT_NAME = /^Inject(?:[A-Z][A-Za-z0-9]*)?$/

/** True for a raw injection call: one of the five reserved names, or any `Inject*` function a package declares. */
const isRawInject = (callee) => {
    if (callee.name === null) return false
    if (callee.module !== null) return INJECT_NAME.test(callee.name)
    return callee.ambient && RAW_NAMES.has(callee.name)
}

/** True for a file whose NAME role is an injector home. */
const isDecoratorsFile = (filename) => posix.basename(normalizePath(filename)).endsWith(".decorators.ts")

/** True when the file sits directly in an owner root (`src/modules/platform/clock/`), which is where its owner's injectors live. */
const atOwnerRoot = (hfs, filename) => {
    const owner = hfs.ownerOf(filename)
    return owner !== null && posix.dirname(hfs.relative(filename)) === owner
}

/** True for a file of the `platform/composition` owner, the home of `injector` and `TypedParameterDecorator`. */
const inComposition = (hfs, file) => {
    if (!file || file.includes("/node_modules/") || hfs.tierOf(file) !== "platform") return false
    const owner = hfs.ownerOf(file)
    return owner !== null && posix.basename(owner) === "composition"
}

/** The decorators of a constructor parameter: on the parameter, its wrapper (`private readonly x`) or its inner identifier. */
const decoratorsOfParam = (param) => {
    const inner = param.type === "TSParameterProperty" ? param.parameter : param
    const target = inner.type === "AssignmentPattern" ? inner.left : inner
    return { target, decorators: [...new Set([...(param.decorators ?? []), ...(inner.decorators ?? []), ...(target.decorators ?? [])])] }
}

/** The injected type `T` of a call typed `TypedParameterDecorator<T>`, else null. */
const injectedTypeOf = (context, call) => {
    const { checker, toTs } = typed(context)
    const tsCall = toTs(call)
    if (!tsCall) return null
    const type = checker.getTypeAtLocation(tsCall)
    if (type.aliasSymbol?.name === "TypedParameterDecorator" && type.aliasTypeArguments?.length === 1) return type.aliasTypeArguments[0]
    return null
}

/** The parameters of every constructor a class declares. */
const constructorParams = (node) => (node.kind === "constructor" && node.value?.params) || []

/** True when the function around a decorated parameter is a class constructor. */
const isConstructorParam = (decorator) => {
    let node = decorator.parent
    while (node && !/^(?:FunctionExpression|ArrowFunctionExpression|FunctionDeclaration|ClassDeclaration|ClassExpression|Program)$/.test(node.type)) node = node.parent
    return node?.type === "FunctionExpression" && node.parent?.type === "MethodDefinition" && node.parent.kind === "constructor"
}

/** True when a decorator sits on a class member or a parameter (not on a class). */
const memberKind = (decorator) => {
    const owner = decorator.parent
    if (!owner) return "class"
    if (owner.type === "PropertyDefinition" || owner.type === "AccessorProperty") return "property"
    if (owner.type === "MethodDefinition") return "method"
    if (owner.type === "ClassDeclaration" || owner.type === "ClassExpression") return "class"
    return "parameter"
}

// -- injector-only ---------------------------------------------------------------------------------

/** Raw injection lives only in `<owner>.decorators.ts`; injectors decorate constructor parameters. */
export const injectorOnly = {
    meta: {
        type: "problem",
        docs: { description: "`Inject(...)` and third-party `Inject*` are called only in `<owner>.decorators.ts` at an owner root; injectors decorate constructor parameters." },
        schema: [],
        messages: {
            rawCall: "`{{name}}(...)` is called outside a `<owner>.decorators.ts` at an owner root. Raw injection puts the token choice at every call site; write `Inject<Thing>()` once in the owner's decorators file (`injector<T>(token)`) and decorate the parameter with it.",
            rawDecorator: "`@{{name}}(...)` is a raw injection decorator. Decorate the constructor parameter with the owner's `Inject<Thing>()` instead; the raw call belongs inside that injector in `<owner>.decorators.ts`.",
            property: "`@{{name}}()` decorates a class property. Injectors decorate constructor parameters only; move the dependency to a constructor parameter.",
            notConstructor: "`@{{name}}()` decorates a parameter that is not a constructor parameter. Injectors decorate constructor parameters only.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const home = isDecoratorsFile(filename) && atOwnerRoot(hfs, filename)
        return {
            Decorator(node) {
                const expression = node.expression
                if (expression.type !== "CallExpression" && expression.type !== "Identifier") return
                const callee = calleeOf(context, expression)
                const written = callee.name ?? ""
                if (isRawInject(callee)) {
                    context.report({ node, messageId: "rawDecorator", data: { name: written } })
                    return
                }
                if (!INJECT_NAME.test(written)) return
                const kind = memberKind(node)
                if (kind === "property" || kind === "method") context.report({ node, messageId: "property", data: { name: written } })
                else if (kind === "parameter" && !isConstructorParam(node)) context.report({ node, messageId: "notConstructor", data: { name: written } })
            },
            CallExpression(node) {
                if (home) return
                if (node.parent?.type === "Decorator" && node.parent.expression === node) return
                const callee = calleeOf(context, node)
                if (isRawInject(callee)) context.report({ node, messageId: "rawCall", data: { name: callee.name } })
            },
        }
    },
}

// -- injector-shape --------------------------------------------------------------------------------

/** The nearest JSDoc block before a statement, else null. */
const jsdocBefore = (context, statement) => {
    const comments = context.sourceCode.getCommentsBefore(statement)
    const last = comments[comments.length - 1]
    return last && last.type === "Block" && last.value.startsWith("*") && last.value.replace(/[*\s]/g, "") !== "" ? last.value : null
}

/** The single expression a function returns (arrow expression body, or a block that is one `return`), else null. */
const returnedExpression = (fn) => {
    if (fn.body.type !== "BlockStatement") return fn.body
    const [only] = fn.body.body
    return fn.body.body.length === 1 && only.type === "ReturnStatement" ? only.argument : null
}

/** The type arguments of a node, in either parser spelling. */
const typeArgsOf = (node) => (node.typeArguments ?? node.typeParameters)?.params ?? []

/** The exported function-like bindings of a statement: `[{ name, fn, id }]`. */
const exportedFunctions = (statement) => {
    const declaration = statement.declaration
    if (!declaration) return []
    if (declaration.type === "FunctionDeclaration" && declaration.id) return [{ name: declaration.id.name, fn: declaration, id: declaration.id }]
    if (declaration.type !== "VariableDeclaration") return []
    return declaration.declarations
        .filter((entry) => entry.id.type === "Identifier" && entry.init && /^(?:ArrowFunctionExpression|FunctionExpression)$/.test(entry.init.type))
        .map((entry) => ({ name: entry.id.name, fn: entry.init, id: entry.id }))
}

/** True when an initializer is a call whose callee is named `injector` (whatever it resolves to is checked later). */
const callsInjector = (context, fn) => {
    const expression = returnedExpression(fn)
    return expression?.type === "CallExpression" && expression.callee.type === "Identifier" && expression.callee.name === "injector"
}

/** True for an `Inject<Thing>`-looking export (the convention's fixed vocabulary), excluding the builder itself. */
const looksLikeInjector = (context, entry) =>
    entry.name !== "injector" && (/^[Ii]nject/.test(entry.name) || entry.fn.returnType?.typeAnnotation?.typeName?.name === "TypedParameterDecorator" || callsInjector(context, entry.fn))

/** True for a value that is a class or a `unique symbol`. */
const isTokenType = (type) => {
    if (type.isUnion()) return type.types.every(isTokenType)
    if (type.flags & ts.TypeFlags.UniqueESSymbol) return true
    if (type.getConstructSignatures().length > 0) return true
    return Boolean(type.symbol && type.symbol.flags & ts.SymbolFlags.Class)
}

/** True for a string type (a string literal, `string`, or a union of them). */
const isStringType = (type) => (type.isUnion() ? type.types.every(isStringType) : (type.flags & ts.TypeFlags.StringLike) !== 0)

/** The value of a `provide:` property. */
const provideValue = (node) => {
    if (node.type !== "Property" || node.parent?.type !== "ObjectExpression" || (node.computed && node.key.type !== "Literal")) return null
    const name = node.key.type === "Identifier" ? node.key.name : node.key.value
    return name === "provide" ? node.value : null
}

/** The shape of an injector, its token and the `provide:` tokens of a module. */
export const injectorShape = {
    meta: {
        type: "problem",
        docs: { description: "An injector is `(): TypedParameterDecorator<T> => injector<T>(token)` with JSDoc, over a `unique symbol` token." },
        schema: [],
        messages: {
            name: "`{{name}}` must be named `Inject` followed by a PascalCase thing (`InjectClock`, `InjectPrimaryEntityManager`).",
            params: "`{{name}}` takes a parameter. An injector is zero-argument; a keyed variant is a separate injector (`InjectDigitalOceanS3`, `InjectMinioS3`, never `InjectS3(key)`).",
            returnType: "`{{name}}` must declare its return type `TypedParameterDecorator<T>` from `platform/composition`, so the lint rule can compare `T` with the parameter annotation.",
            body: "`{{name}}` must be exactly `injector<T>(token)` with the same `T` as its return type, `injector` imported from `platform/composition`.",
            jsdoc: "`{{name}}` needs a JSDoc comment that names the injected type (`Injects the Clock port. Parameter type: Clock.`).",
            tokenType: "The token `{{name}}` must be declared `export const {{name}}: unique symbol = Symbol(\"<owner>.<thing>\")`.",
            tokenName: "The token `{{name}}` must be described `<owner>.<thing>` in lower-case dotted words that include its owner `{{owner}}` (`Symbol(\"platform.clock\")`).",
            provide: "`provide:` must be a class or a `unique symbol` token, not a value of type `{{type}}`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const listeners = {
            Property(node) {
                const value = provideValue(node)
                if (!value) return
                const { checker, toTs } = typed(context)
                const tsValue = toTs(value)
                if (!tsValue) return
                const type = checker.getTypeAtLocation(tsValue)
                if (isStringType(type) || isTokenType(type)) return
                context.report({ node: value, messageId: "provide", data: { type: checker.typeToString(type) } })
            },
        }
        if (!isDecoratorsFile(filename)) return listeners
        const ownerName = posix.basename(hfs.ownerOf(filename) ?? "")
        return {
            ...listeners,
            ExportNamedDeclaration(statement) {
                for (const entry of exportedFunctions(statement)) {
                    if (!looksLikeInjector(context, entry)) continue
                    checkInjector(context, hfs, statement, entry)
                }
                if (statement.declaration?.type !== "VariableDeclaration") return
                for (const entry of statement.declaration.declarations) {
                    const init = entry.init
                    const symbolCall = init?.type === "CallExpression" && (init.callee.type === "Identifier" ? init.callee.name === "Symbol" : init.callee.type === "MemberExpression" && init.callee.object.type === "Identifier" && init.callee.object.name === "Symbol")
                    if (!symbolCall || entry.id.type !== "Identifier") continue
                    const annotation = entry.id.typeAnnotation?.typeAnnotation
                    const unique = annotation?.type === "TSTypeOperator" && annotation.operator === "unique" && annotation.typeAnnotation?.type === "TSSymbolKeyword"
                    const description = init.callee.type === "Identifier" && init.arguments.length === 1 ? staticText(init.arguments[0]) : null
                    if (!unique) context.report({ node: entry.id, messageId: "tokenType", data: { name: entry.id.name } })
                    else if (description === null || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(description) || !description.split(".").includes(ownerName)) {
                        context.report({ node: entry.id, messageId: "tokenName", data: { name: entry.id.name, owner: ownerName } })
                    }
                }
            },
        }
    },
}

/** Reports every way one exported injector departs from the canonical shape. */
const checkInjector = (context, hfs, statement, { name, fn, id }) => {
    const data = { name }
    if (!/^Inject[A-Z][A-Za-z0-9]*$/.test(name)) context.report({ node: id, messageId: "name", data })
    if (fn.params.length > 0) context.report({ node: fn.params[0], messageId: "params", data })
    const annotation = fn.returnType?.typeAnnotation
    const wellTyped = annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier" && annotation.typeName.name === "TypedParameterDecorator" && typeArgsOf(annotation).length === 1
    const fromComposition = wellTyped && typeOrigins(context, annotation).some((origin) => origin.name === "TypedParameterDecorator" && inComposition(hfs, origin.file))
    if (!fromComposition) {
        context.report({ node: fn.returnType ?? id, messageId: "returnType", data })
        return
    }
    const injected = typeArgsOf(annotation)[0]
    const injectedText = context.sourceCode.getText(injected)
    const call = returnedExpression(fn)
    const built = call?.type === "CallExpression" && call.callee.type === "Identifier" && call.callee.name === "injector"
        && call.arguments.length === 1 && typeArgsOf(call).length === 1 && context.sourceCode.getText(typeArgsOf(call)[0]) === injectedText
        && inComposition(hfs, calleeOf(context, call).file)
    if (!built) context.report({ node: call ?? fn, messageId: "body", data })
    const doc = jsdocBefore(context, statement)
    const mention = injectedText.match(/[A-Za-z_$][\w$]*/)?.[0] ?? injectedText
    if (doc === null || !new RegExp(`\\b${mention.replace(/\$/g, "\\$")}\\b`).test(doc)) context.report({ node: id, messageId: "jsdoc", data })
}

// -- injector-type-match ---------------------------------------------------------------------------

/** `T` of the injector equals the parameter annotation. */
export const injectorTypeMatch = {
    meta: {
        type: "problem",
        docs: { description: "The `T` of an injector's `TypedParameterDecorator<T>` is the type the parameter is annotated with." },
        schema: [],
        messages: {
            mismatch: "`@{{injector}}()` injects `{{injected}}` but the parameter is declared `{{declared}}`. Annotate the parameter with `{{injected}}`, or use the injector of `{{declared}}`.",
            unresolved: "`@{{injector}}()` injects a type the checker cannot resolve, so it cannot be compared with `{{declared}}`. Fix the injector's `TypedParameterDecorator<T>` so `T` is a concrete type.",
            unannotated: "A parameter decorated `@{{injector}}()` has no type annotation. Annotate it with `{{injected}}`.",
        },
    },
    create(context) {
        return {
            MethodDefinition(node) {
                for (const param of constructorParams(node)) {
                    const { target, decorators } = decoratorsOfParam(param)
                    for (const decorator of decorators) {
                        if (decorator.expression.type !== "CallExpression") continue
                        const injected = injectedTypeOf(context, decorator.expression)
                        if (!injected) continue
                        check(context, decorator, target, injected)
                    }
                }
            },
        }
    },
}

/** Compares one injector's `T` with the annotation of the parameter it decorates. */
const check = (context, decorator, target, injected) => {
    const { checker, toTs } = typed(context)
    const callee = decorator.expression.callee
    const injector = callee.type === "Identifier" ? callee.name : (staticPropertyName(callee) ?? "Inject")
    const annotation = target.typeAnnotation?.typeAnnotation
    const injectedName = checker.typeToString(injected)
    if (!annotation) {
        context.report({ node: target, messageId: "unannotated", data: { injector, injected: injectedName } })
        return
    }
    const tsAnnotation = toTs(annotation)
    if (!tsAnnotation) return
    const declared = checker.getNonNullableType(checker.getTypeFromTypeNode(tsAnnotation))
    const declaredName = checker.typeToString(declared)
    if (injected.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
        context.report({ node: decorator, messageId: "unresolved", data: { injector, declared: declaredName } })
        return
    }
    if (injected === declared) return
    if (checker.isTypeAssignableTo(injected, declared) && checker.isTypeAssignableTo(declared, injected)) return
    context.report({ node: annotation, messageId: "mismatch", data: { injector, injected: injectedName, declared: declaredName } })
}

// -- infra-needs-injector --------------------------------------------------------------------------

/** A constructor parameter of an infrastructure type carries an injector. */
export const infraNeedsInjector = {
    meta: {
        type: "problem",
        docs: { description: "A constructor parameter typed by a platform/integrations declaration or a package carries an `Inject<Thing>()` decorator." },
        schema: [],
        messages: {
            missing: "`{{type}}` is infrastructure ({{where}}) and is injected here without an injector. Decorate the parameter with the owner's `Inject<Thing>()`; only domain services and types of this owner are injected by class.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const own = hfs.ownerOf(filename)
        return {
            MethodDefinition(node) {
                // A CQRS message (`extends Command<R>` / `Query<R>` of @nestjs/cqrs) is built by its caller, never by the container.
                const heritage = node.parent?.parent?.superClass
                if (heritage && isPackageExport(context, heritage, "@nestjs/cqrs")) return
                for (const param of constructorParams(node)) {
                    const { target, decorators } = decoratorsOfParam(param)
                    const annotation = target.typeAnnotation?.typeAnnotation
                    if (!annotation) continue
                    const infra = typeOrigins(context, annotation).find((origin) => {
                        if (origin.module !== null) return !/\/node_modules\/typescript\/lib\//.test(origin.file)
                        if (own !== null && hfs.ownerOf(origin.file) === own) return false
                        const tier = hfs.tierOf(origin.file)
                        return tier === "platform" || tier === "integrations"
                    })
                    if (!infra) continue
                    const carries = decorators.some((decorator) => {
                        const expression = decorator.expression
                        if (expression.type !== "CallExpression") return false
                        return INJECT_NAME.test(calleeOf(context, expression).name ?? "") || injectedTypeOf(context, expression) !== null
                    })
                    if (carries) continue
                    const where = infra.module !== null ? `package ${infra.module}` : `${hfs.tierOf(infra.file)} ${posix.basename(hfs.ownerOf(infra.file) ?? "")}`
                    context.report({ node: target, messageId: "missing", data: { type: infra.name || context.sourceCode.getText(annotation), where } })
                }
            },
        }
    },
}

// -- no-module-ref ---------------------------------------------------------------------------------

const MODULE_REF_CALLS = new Set(["get", "resolve", "create"])

/** No service locator: `ModuleRef` is not imported, typed or called. */
export const noModuleRef = {
    meta: {
        type: "problem",
        docs: { description: "`ModuleRef` (a service locator) is not used in product code or specs." },
        schema: [],
        messages: {
            use: "`ModuleRef` is a service locator that bypasses every injection rule. Inject the dependency through its `Inject<Thing>()` in the constructor.",
        },
    },
    create(context) {
        const isModuleRef = (node) => typeOrigins(context, node).some((origin) => origin.name === "ModuleRef" && origin.module === "@nestjs/core")
        return {
            ImportDeclaration(node) {
                if (node.source.value !== "@nestjs/core") return
                for (const specifier of node.specifiers) {
                    if (specifier.type === "ImportSpecifier" && (specifier.imported.name ?? specifier.imported.value) === "ModuleRef") context.report({ node: specifier, messageId: "use" })
                }
            },
            ExportNamedDeclaration(node) {
                if (node.source?.value !== "@nestjs/core") return
                for (const specifier of node.specifiers) {
                    if ((specifier.local.name ?? specifier.local.value) === "ModuleRef") context.report({ node: specifier, messageId: "use" })
                }
            },
            TSTypeReference(node) {
                const name = node.typeName.type === "Identifier" ? node.typeName.name : node.typeName.right?.name
                if (name === "ModuleRef" && isModuleRef(node)) context.report({ node, messageId: "use" })
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || !MODULE_REF_CALLS.has(staticPropertyName(callee) ?? "")) return
                if (isModuleRef(callee.object)) context.report({ node: callee, messageId: "use" })
            },
        }
    },
}

// -- no-forward-ref --------------------------------------------------------------------------------

/** No `forwardRef(`: a cycle is a layering finding, not a DI trick. */
export const noForwardRef = {
    meta: {
        type: "problem",
        docs: { description: "`forwardRef(...)` is not called." },
        schema: [],
        messages: {
            cycle: "`forwardRef(...)` hides an import or provider cycle. Break the cycle (move the shared part to a lower owner); it is a layering finding, not an injection detail.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const callee = calleeOf(context, node)
                if (callee.name === "forwardRef" && (callee.module !== null || callee.ambient)) context.report({ node, messageId: "cycle" })
            },
        }
    },
}

// -- no-string-token -------------------------------------------------------------------------------

const TOKEN_GETTERS = new Set(["getEntityManagerToken", "getDataSourceToken"])

/** A token is a class or a `unique symbol`, never a string. */
export const noStringToken = {
    meta: {
        type: "problem",
        docs: { description: "An injection token is never a string or template literal." },
        schema: [],
        messages: {
            string: "A string is used as an injection token. Tokens are a class or `export const THING: unique symbol = Symbol(\"<owner>.<thing>\")` in the owner's `<owner>.decorators.ts`; strings collide silently.",
            connection: "`{{name}}(\"...\")` takes a string literal. Name the connection once as a constant in `<conn>.connection.ts` and pass that constant.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        const isString = (node) => {
            if (isPackageExport(context, node, "@nestjs/core")) return false
            if (node.type === "CallExpression" && TOKEN_GETTERS.has(calleeOf(context, node).name ?? "")) return false
            if (staticText(node) !== null) return true
            if (node.type === "TemplateLiteral") return true
            const { checker, toTs } = typed(context)
            const tsNode = toTs(node)
            return tsNode ? isStringType(checker.getTypeAtLocation(tsNode)) : false
        }
        return {
            Property(node) {
                const value = provideValue(node)
                if (value && isString(value)) context.report({ node: value, messageId: "string" })
            },
            CallExpression(node) {
                const [first] = node.arguments
                if (!first) return
                const callee = calleeOf(context, node)
                if (isRawInject(callee) || callee.name === "injector") {
                    if (isString(first)) context.report({ node: first, messageId: "string" })
                } else if (TOKEN_GETTERS.has(callee.name ?? "") && callee.module !== null && !posix.basename(normalizePath(filename)).endsWith(".connection.ts")) {
                    if (staticText(first) !== null || first.type === "TemplateLiteral") context.report({ node: first, messageId: "connection", data: { name: callee.name } })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "injector-only": injectorOnly,
    "injector-shape": injectorShape,
    "injector-type-match": injectorTypeMatch,
    "infra-needs-injector": infraNeedsInjector,
    "no-module-ref": noModuleRef,
    "no-forward-ref": noForwardRef,
    "no-string-token": noStringToken,
}

/** All start at error: there is one way to inject and no baseline. */
export const recommended = {
    "starci-be/injector-only": "error",
    "starci-be/injector-shape": "error",
    "starci-be/injector-type-match": "error",
    "starci-be/infra-needs-injector": "error",
    "starci-be/no-module-ref": "error",
    "starci-be/no-forward-ref": "error",
    "starci-be/no-string-token": "error",
}
