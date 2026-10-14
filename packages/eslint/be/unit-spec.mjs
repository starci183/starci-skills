/**
 * The rules that hold the FORM of a unit spec (R48 `BE_SPEC_QUALITY`, extended by R281 `BE_SPEC_FORM_ALL_ROLES`).
 *
 * A unit spec is `<name>.<role>.spec.ts` beside its logic-role subject (R47). It builds the subject the way Nest builds it
 * and takes every double from the one shared kit, `@starci/jest-preset`:
 *
 *   - `spec-builds-with-testing-module`: the spec calls `Test.createTestingModule(...)` from `@nestjs/testing`, awaits
 *     `.compile()` and reads the subject with `.get(...)` on the resulting `TestingModule`.
 *   - `spec-no-new-subject`: the subject (the class of the sibling `<name>.<role>.ts`) is never built with `new`.
 *   - `spec-module-definition-only-providers`: the module definition has a `providers` list and nothing else: no `imports` key
 *     and no `override*` call (`overrideProvider`, `overrideGuard`, `overrideModule`, `overrideFilter`, `overridePipe`,
 *     `overrideInterceptor`).
 *   - `spec-no-module-mock`: no `jest.mock`, `jest.doMock`, `jest.unstable_mockModule`, `jest.requireMock`, `jest.setMock`, of
 *     an own module or of a third-party library: a collaborator is provided through its injection token.
 *   - `no-return-only-generic`: no helper in a spec or in the test fixtures launders a cast into a name: a type parameter that
 *     appears only in the return type (`<T>(value: unknown): T`), an `unknown`/`any` parameter handed back as a concrete type,
 *     `JSON.parse(JSON.stringify(x))`, or `Object.assign(new X(), y)` returned as another type.
 *   - `spec-infra-double-from-kit`: a provider `{ provide: TOKEN, useValue: X }` takes X from the kit double the token calls
 *     for. The table (token pattern -> double) is `ruleParams.be.specDoubles` of the slot manifest, not this file.
 *   - `spec-exact-values`: no `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)` (`expect` being the jest global
 *     or the `@jest/globals` import): ids and clocks come from the kit's deterministic doubles (`fakeIds()`, `FakeClock`), so a
 *     unit spec asserts the exact value.
 *   - `spec-behavior-assertion`: every `it`/`test` asserts a result or effect; a spec with only presence/truthiness
 *     assertions must assert an exact result or effect.
 *
 * Paths are asked of the slot manifest (`lib/unit-spec.mjs`), a name is judged by the import that binds it, never by its spelling.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { keyName, walk } from "./lib/ast.mjs"
import { importOf, isImportedFrom } from "./lib/import-source.mjs"
import { isPackageType, typeOrigins } from "./lib/types.mjs"
import { baseOf, isServiceSpecFile, isUnitSpecFile, unitRoleOfSpec } from "./lib/unit-spec.mjs"

const TESTING_PACKAGE = "@nestjs/testing"

/** Existing service specs and every other unit-tested logic role declared by the manifest. */
const isFormSpecFile = (hfs, filename) => isServiceSpecFile(hfs, filename) || unitRoleOfSpec(hfs, filename) !== null

/** Whether this callee creates a Nest testing module through its actual import. */
const isTestingFactory = (context, callee) => {
    if (callee.type !== "MemberExpression" || callee.computed || keyName(callee.property) !== "createTestingModule") return false
    const found = importOf(context, callee.object)
    return found?.source === TESTING_PACKAGE && found.imported === "Test"
}

/** The last call in a chain `Test.createTestingModule(...).<a>().<b>()`: the `createTestingModule` call at its root, or null. */
const testingModuleRoot = (context, node) => {
    let cursor = node
    while (cursor) {
        if (cursor.type === "CallExpression") {
            const callee = cursor.callee
            if (isTestingFactory(context, callee)) return cursor
            cursor = callee.type === "MemberExpression" ? callee.object : null
        } else if (cursor.type === "MemberExpression") cursor = cursor.object
        else if (cursor.type === "AwaitExpression") cursor = cursor.argument
        else return null
    }
    return null
}

/** True for `Test.createTestingModule(...)` where `Test` is the import of `@nestjs/testing`. */
const isCreateTestingModule = (context, node) => node.type === "CallExpression" && testingModuleRoot(context, node) === node

// -- spec-builds-with-testing-module ---------------------------------------------------------------------------

/** A logic-role spec builds its subject through the Nest testing module. */
export const specBuildsWithTestingModule = {
    meta: {
        type: "problem",
        docs: { description: "A logic-role unit spec calls `Test.createTestingModule(...)` from `@nestjs/testing`, awaits `.compile()` and reads the subject with `.get(...)`." },
        schema: [],
        messages: {
            noModule: "[BE_SPEC_FORM_ALL_ROLES] This logic-role spec never calls `Test.createTestingModule(...)` from `@nestjs/testing`. Build the subject the way Nest does, so its constructor injectors are exercised: `const moduleRef = await Test.createTestingModule({ providers: [Subject, { provide: TOKEN, useValue: double }] }).compile()`.",
            noCompile: "[BE_SPEC_FORM_ALL_ROLES] `Test.createTestingModule(...)` is never followed by `.compile()`, so no module exists to read the subject from.",
            noGet: "[BE_SPEC_FORM_ALL_ROLES] The subject is never read with `moduleRef.get(Subject)` from the compiled `TestingModule`. Read it from the module, do not hold a second construction path.",
        },
    },
    create(context) {
        if (!isFormSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        let created = null
        let compiled = false
        let read = false
        return {
            CallExpression(node) {
                if (isCreateTestingModule(context, node)) created ??= node
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (callee.property.name === "compile" && (testingModuleRoot(context, callee.object) !== null || isPackageType(context, callee.object, "TestingModuleBuilder", TESTING_PACKAGE))) compiled = true
                if (callee.property.name === "get" && isPackageType(context, callee.object, "TestingModule", TESTING_PACKAGE)) read = true
            },
            "Program:exit"(node) {
                if (created === null) context.report({ node, messageId: "noModule" })
                else if (!compiled) context.report({ node: created, messageId: "noCompile" })
                else if (!read) context.report({ node: created, messageId: "noGet" })
            },
        }
    },
}

// -- spec-no-new-subject ---------------------------------------------------------------------------------------

/** The last path segment of a module specifier, without an extension. */
const moduleStem = (specifier) => String(specifier).replace(/\\/g, "/").split("/").pop().replace(/\.[cm]?[jt]s$/, "")

/** The logic-role subject is never constructed by hand. */
export const specNoNewSubject = {
    meta: {
        type: "problem",
        docs: { description: "A logic-role unit spec never builds its subject with `new`." },
        schema: [],
        messages: {
            construct: "[BE_SPEC_FORM_ALL_ROLES] `new {{name}}(...)` builds the subject by hand, so its injectors are never exercised and a constructor change goes unnoticed. Provide it in `Test.createTestingModule({ providers: [{{name}}, ...] })` and read it with `moduleRef.get({{name}})`.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (!isFormSpecFile(hfsOf(context), filename)) return {}
        const stem = baseOf(filename).replace(/\.spec\.ts$/, "")
        const locals = new Set()
        const namespaces = new Set()
        return {
            ImportDeclaration(node) {
                if (moduleStem(node.source.value) !== stem) return
                for (const specifier of node.specifiers) (specifier.type === "ImportNamespaceSpecifier" ? namespaces : locals).add(specifier.local.name)
            },
            NewExpression(node) {
                const callee = node.callee
                const subject = callee.type === "Identifier" && locals.has(callee.name)
                    || callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && namespaces.has(callee.object.name)
                if (subject) context.report({ node, messageId: "construct", data: { name: context.sourceCode.getText(callee) } })
            },
        }
    },
}

// -- spec-module-definition-only-providers -----------------------------------------------------------------------

/** The `override*` members of `TestingModuleBuilder`. */
const OVERRIDES = new Set(["overrideProvider", "overrideGuard", "overrideModule", "overrideFilter", "overridePipe", "overrideInterceptor"])

/** The testing module lists providers and nothing else. */
export const specModuleDefinitionOnlyProviders = {
    meta: {
        type: "problem",
        docs: { description: "A logic-role unit spec's testing module has no `imports` key and no `override*` call." },
        schema: [],
        messages: {
            imports: "[BE_SPEC_FORM_ALL_ROLES] `imports` pulls a real module into a unit spec, so the test runs the module's providers instead of the doubles you list. Provide exactly the subject's constructor dependencies in `providers`.",
            override: "[BE_SPEC_FORM_ALL_ROLES] `{{method}}` swaps a provider after the module was declared. A unit spec provides its double up front: `providers: [Subject, { provide: TOKEN, useValue: double }]`.",
        },
    },
    create(context) {
        if (!isFormSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                if (isCreateTestingModule(context, node)) {
                    const definition = node.arguments[0]
                    if (definition?.type !== "ObjectExpression") return
                    for (const property of definition.properties) {
                        const key = property.type === "Property" ? (property.key.name ?? property.key.value) : null
                        if (key === "imports") context.report({ node: property, messageId: "imports" })
                    }
                    return
                }
                const callee = node.callee
                if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && OVERRIDES.has(callee.property.name)) {
                    context.report({ node: callee.property, messageId: "override", data: { method: callee.property.name } })
                }
            },
        }
    },
}

// -- spec-no-module-mock ---------------------------------------------------------------------------------------

/** The `jest` members that replace or fetch a module for the whole file. */
const MODULE_MOCKS = new Set(["mock", "doMock", "unstable_mockModule", "requireMock", "setMock"])

/** Whether the identifier `name` is the ambient global (or, when `source` is given, that import), not a local binding: `jest` and `expect` are the jest globals or `@jest/globals` imports. */
const isAmbientOrImported = (context, node, name, source) => {
    if (node.type !== "Identifier" || node.name !== name) return false
    const imported = importOf(context, node)
    if (imported) return source !== null && imported.source === source && imported.imported === name
    for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(name)
        if (variable) return variable.defs.length === 0 || scope.type === "global" || variable.defs.every((definition) => definition.node?.parent?.declare === true)
    }
    return true
}

/** A unit spec replaces no module, its own or a library's. */
export const specNoModuleMock = {
    meta: {
        type: "problem",
        docs: { description: "A unit spec never calls `jest.mock`, `jest.doMock`, `jest.unstable_mockModule` or `jest.requireMock`." },
        schema: [],
        messages: {
            moduleMock: "[BE_SPEC_FORM_ALL_ROLES] `jest.{{method}}(...)` replaces a whole module, so the subject runs against a stand-in the production wiring never has. Provide a collaborator through its injection token (`{ provide: TOKEN, useValue: mock<Port>() }`); a third-party library is reached through the wrapper that owns it, and the wrapper is the double.",
        },
    },
    create(context) {
        if (!isUnitSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || !MODULE_MOCKS.has(callee.property.name)) return
                if (isAmbientOrImported(context, callee.object, "jest", "@jest/globals")) context.report({ node, messageId: "moduleMock", data: { method: callee.property.name } })
            },
        }
    },
}

// -- no-return-only-generic --------------------------------------------------------------------------------------

/** Names a type reference or type query spells, anywhere below a type node. */
const typeNamesIn = (node) => {
    const names = new Set()
    walk(node, (child) => {
        if (child.type === "TSTypeReference" && child.typeName.type === "Identifier") names.add(child.typeName.name)
    })
    return names
}

/** The expressions a function returns (its expression body, or each `return` of its own body). */
const returnedExpressions = (fn) => {
    if (!fn.body) return []
    if (fn.body.type !== "BlockStatement") return [fn.body]
    const found = []
    walk(fn.body, (node) => {
        if (node.type === "ReturnStatement" && node.argument) found.push(node.argument)
    }, { intoFunctions: false })
    return found
}

/** The expression under any chain of assertions, parentheses and awaits. */
const peel = (expression) => {
    let node = expression
    while (node && (node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression" || node.type === "AwaitExpression")) node = node.expression ?? node.argument
    return node
}

/** Whether a call is `Object.assign(new X(), ...)`; gives X's name. */
const assignedClassOf = (node) => {
    if (node?.type !== "CallExpression") return null
    const callee = node.callee
    if (callee.type !== "MemberExpression" || callee.computed || callee.object.type !== "Identifier" || callee.object.name !== "Object" || callee.property.name !== "assign") return null
    const target = node.arguments[0]
    return target?.type === "NewExpression" && target.callee.type === "Identifier" ? target.callee.name : null
}

/** The declared name of a function or the property that holds it. */
const functionNameOf = (fn) => {
    if (fn.id?.name) return fn.id.name
    const parent = fn.parent
    if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name
    if (parent?.type === "Property" || parent?.type === "MethodDefinition") return parent.key.name ?? parent.key.value
    return "this function"
}

/** Names that the parameter types mention. */
const parameterTypeNames = (fn) => {
    const names = new Set()
    for (const param of fn.params) {
        for (const spelled of typeNamesIn(param.typeAnnotation ?? param.left?.typeAnnotation)) names.add(spelled)
    }
    return names
}

/** Report type parameters chosen only by the caller's expected return type. */
const reportReturnOnlyParameters = (context, fn, name) => {
    const declared = fn.typeParameters?.params ?? []
    const returned = fn.returnType?.typeAnnotation
    if (declared.length === 0 || !returned) return false
    const inReturn = typeNamesIn(returned)
    const inParams = parameterTypeNames(fn)
    let generic = false
    for (const param of declared) {
        const spelled = param.name.name
        // A parameter mentioned by another parameter's bound is driven by the caller's arguments.
        const inBounds = declared.some((other) => other !== param && (typeNamesIn(other.constraint).has(spelled) || typeNamesIn(other.default).has(spelled)))
        if (inReturn.has(spelled) && !inParams.has(spelled) && !inBounds) {
            generic = true
            context.report({ node: param, messageId: "returnOnly", data: { name, param: spelled } })
        }
    }
    return generic
}

/** Untyped parameters handed back by a spec helper. */
const looseParameters = (fn) => {
    const loose = new Map()
    for (const param of fn.params) {
        const target = param.type === "AssignmentPattern" ? param.left : param
        const kind = target.type === "Identifier" ? target.typeAnnotation?.typeAnnotation?.type : undefined
        if (kind === "TSUnknownKeyword" || kind === "TSAnyKeyword") loose.set(target.name, kind === "TSAnyKeyword" ? "any" : "unknown")
    }
    return loose
}

/** Report a helper return that launders an untyped value or a different class. */
const reportHelperReturn = (context, expression, { name, generic, loose, returned }) => {
    const value = peel(expression)
    const returnedType = returned?.type
    const concrete = returnedType !== undefined && returnedType !== "TSUnknownKeyword" && returnedType !== "TSAnyKeyword"
    if (!generic && value.type === "Identifier" && loose.has(value.name) && (concrete || value !== expression)) {
        context.report({ node: expression, messageId: "launder", data: { name, kind: loose.get(value.name) } })
        return true
    }
    const klass = assignedClassOf(value)
    if (klass !== null && returned?.type === "TSTypeReference" && returned.typeName.type === "Identifier" && returned.typeName.name !== klass) {
        context.report({ node: expression, messageId: "assign", data: { klass, returned: returned.typeName.name } })
    }
    return false
}

/** A helper of a spec or of the fixtures is not a cast with a name. */
export const noReturnOnlyGeneric = {
    meta: {
        type: "problem",
        docs: { description: "A spec or a test fixture has no return-only generic, no `unknown`/`any` handed back as a concrete type, no `JSON.parse(JSON.stringify(x))` and no `Object.assign(new X(), y)` returned as another type." },
        schema: [],
        messages: {
            returnOnly: "`{{name}}` declares the type parameter `{{param}}` only in its return type, so the caller picks any type and nothing checks it: `<T>(value: unknown): T` is a cast with a name. Build the double with `mock<T>()`, `mockEntityManager()` or a `builder<T>(defaults)` from `@starci/jest-preset`, which fail to compile when the shape changes.",
            launder: "`{{name}}` takes `{{kind}}` and hands it back as another type: a cast with a name. It keeps compiling when the dependency's shape changes and the double stops matching. Use a typed double from `@starci/jest-preset`.",
            json: "`JSON.parse(JSON.stringify(...))` returns `any`, so it launders whatever type the receiver declares. Build the value with its own type, or clone with `structuredClone`.",
            assign: "`Object.assign(new {{klass}}(), ...)` is returned as `{{returned}}`: an object of one class typed as another. Return the class it builds, or build the other type with its own builder.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (!/\.(?:e2e-|integration-|contract-)?spec\.[cm]?ts$/.test(baseOf(filename)) && hfs.slotOf(filename) !== "be.tests.fixtures") return {}
        const check = (fn) => {
            const name = functionNameOf(fn)
            const generic = reportReturnOnlyParameters(context, fn, name)
            const returned = fn.returnType?.typeAnnotation
            if (fn.body === null || fn.body === undefined) return
            const loose = looseParameters(fn)
            for (const expression of returnedExpressions(fn)) {
                if (reportHelperReturn(context, expression, { name, generic, loose, returned })) return
            }
        }
        return {
            FunctionDeclaration: check,
            FunctionExpression: check,
            ArrowFunctionExpression: check,
            TSDeclareFunction: check,
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.object.type !== "Identifier" || callee.object.name !== "JSON" || callee.property.name !== "parse") return
                const argument = node.arguments[0]
                if (argument?.type === "CallExpression" && argument.callee.type === "MemberExpression" && argument.callee.object.type === "Identifier" && argument.callee.object.name === "JSON" && argument.callee.property.name === "stringify") {
                    context.report({ node, messageId: "json" })
                }
            },
        }
    },
}

// -- spec-infra-double-from-kit --------------------------------------------------------------------------------

/** `EntityManager` -> `ENTITY_MANAGER`, `redis-cache` -> `REDIS_CACHE`. */
const screamingSnake = (name) => String(name).replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z])([A-Z][a-z])/g, "$1_$2").toUpperCase().replace(/[^A-Z0-9]+/g, "_")

/** The name a provider token spells: an identifier, the last member of `Tokens.CLOCK`, a string, a called token factory's name. */
const tokenName = (node) => {
    if (!node) return null
    if (node.type === "Identifier") return node.name
    if (node.type === "Literal" && typeof node.value === "string") return node.value
    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") return node.property.name
    if (node.type === "CallExpression") return tokenName(node.callee)
    return null
}

/** The compiled table of a manifest's `specDoubles`, cached per manifest object. */
const COMPILED = new WeakMap()
const tableOf = (specDoubles) => {
    let compiled = COMPILED.get(specDoubles)
    if (!compiled) {
        compiled = { kit: specDoubles.kit, entries: specDoubles.doubles.map((entry) => ({ ...entry, pattern: new RegExp(entry.token) })), fallback: specDoubles.fallback }
        COMPILED.set(specDoubles, compiled)
    }
    return compiled
}

/** A const identifier's initializer, or null when its value cannot be followed. */
const constantInitializer = (context, value) => {
    for (let scope = context.sourceCode.getScope(value); scope; scope = scope.upper) {
        const variable = scope.set.get(value.name)
        if (!variable) continue
        const definition = variable.defs[0]
        if (definition?.type === "Variable" && definition.node.id.type === "Identifier" && definition.node.init && definition.parent.kind === "const") return definition.node.init
        return null
    }
    return null
}

/** A value's form and the double it names: `{ form, name }`, or null when it is not a form the table knows. */
const formOf = (context, node, depth = 0) => {
    const value = peel(node)
    switch (value.type) {
        case "CallExpression":
            if (value.callee.type === "Identifier") return { form: "call", name: value.callee.name, node: value.callee }
            if (value.callee.type === "CallExpression" && value.callee.callee.type === "Identifier") return { form: "curried", name: value.callee.callee.name, node: value.callee.callee }
            return null
        case "NewExpression":
            return value.callee.type === "Identifier" ? { form: "new", name: value.callee.name, node: value.callee } : null
        case "ObjectExpression":
            return { form: "object" }
        case "ArrayExpression":
            return { form: "array" }
        case "Literal":
            return { form: "primitive" }
        case "TemplateLiteral":
            return value.expressions.length === 0 ? { form: "primitive" } : null
        case "Identifier": {
            if (depth >= 3) return null
            const initializer = constantInitializer(context, value)
            return initializer === null ? null : formOf(context, initializer, depth + 1)
        }
        default:
            return null
    }
}

/** The kit type each double produces, by declared name: what a parameter or a property typed so is a double of. */
const KIT_TYPES = Object.freeze({ MockEntityManager: "mockEntityManager", FakeCache: "fakeCache", FakeLock: "fakeLock", RecordingEventBus: "recordingEventBus", RecordingQueueOutbox: "recordingQueueOutbox", FakeClock: "FakeClock", FakeIds: "fakeIds", FakeTransaction: "fakeTransaction" })

/** The kit double a value's TYPE says it is (a helper parameter typed `MockEntityManager`, `tx.em` of a `fakeTransaction`), or null. */
const kitDoubleOfType = (context, node, kit) => {
    const found = typeOrigins(context, node).find((origin) => Object.hasOwn(KIT_TYPES, origin.name) && origin.module === kit)
    return found ? KIT_TYPES[found.name] : null
}

/** How an actual double value is written in a diagnostic. */
const describeDoubleValue = (found) => {
    if (found.name === undefined) return `a ${found.form} value`
    const prefix = found.form === "new" ? "new " : ""
    return `\`${prefix}${found.name}(...)\``
}

/** Judge a provider that is traced by its declared type instead of its initializer. */
const checkTypedDouble = (context, node, table, entry, data) => {
    const typedAs = kitDoubleOfType(context, node.value, table.kit)
    if (typedAs === null) return context.report({ node: node.value, messageId: "unknown", data })
    if (typedAs !== entry.double) return context.report({ node: node.value, messageId: "wrong", data: { ...data, got: `a \`${typedAs}\` double` } })
    return undefined
}

/** The double a token's provider value must come from. */
export const specInfraDoubleFromKit = {
    meta: {
        type: "problem",
        docs: { description: "In a logic-role unit spec a provider `{ provide: TOKEN, useValue: X }` takes X from the `@starci/jest-preset` double the token calls for (`ruleParams.be.specDoubles`)." },
        schema: [],
        messages: {
            wrong: "[BE_SPEC_FORM_ALL_ROLES] `{{token}}` is provided with {{got}}, but a token of this kind takes {{want}} from `{{kit}}`. The kit double is behavioural (or, for `mock`, typed against the port), a hand-built value drifts from the thing it stands for.",
            notKit: "[BE_SPEC_FORM_ALL_ROLES] `{{name}}` is not imported from `{{kit}}`. A double for `{{token}}` is {{want}} of the kit, never a local helper or a lookalike of the same name.",
            unknown: "[BE_SPEC_FORM_ALL_ROLES] The value provided for `{{token}}` cannot be traced to a kit double. Bind it to a `const` initialised with {{want}} from `{{kit}}` (or write the call in place).",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!isFormSpecFile(hfs, context.filename || context.getFilename())) return {}
        const table = tableOf(hfs.ruleParams.specDoubles)
        const describe = (entry) => {
            const forms = entry.forms.map((form) => ({ call: `\`${entry.double}(...)\``, new: `\`new ${entry.double}(...)\``, curried: `\`${entry.double}(...)(...)\``, object: "a plain object literal of real values", primitive: "a real value", array: "an array" })[form])
            return forms.join(" or ")
        }
        return {
            Property(node) {
                if (node.parent.type !== "ObjectExpression" || (node.key.name ?? node.key.value) !== "useValue") return
                const provide = node.parent.properties.find((property) => property.type === "Property" && (property.key.name ?? property.key.value) === "provide")
                const spelled = tokenName(provide?.value)
                if (spelled === null) return
                const normalised = screamingSnake(spelled)
                const entry = table.entries.find((candidate) => candidate.pattern.test(normalised)) ?? table.fallback
                const found = formOf(context, node.value)
                const want = describe(entry)
                const data = { token: spelled, want, kit: table.kit }
                if (found === null) {
                    // not a call, a literal or a traceable const: the declared type of the value decides (a helper parameter, `tx.em`)
                    return checkTypedDouble(context, node, table, entry, data)
                }
                if (!entry.forms.includes(found.form)) {
                    const got = describeDoubleValue(found)
                    return context.report({ node: node.value, messageId: "wrong", data: { ...data, got } })
                }
                if (found.name === undefined) return undefined
                const imported = importOf(context, found.node)
                if (found.name !== entry.double) return context.report({ node: node.value, messageId: "wrong", data: { ...data, got: describeDoubleValue(found) } })
                if (!imported || !(imported.source === table.kit || imported.source.startsWith(`${table.kit}/`)) || imported.imported !== entry.double) return context.report({ node: node.value, messageId: "notKit", data: { ...data, name: found.name } })
                return undefined
            },
        }
    },
}

// -- spec-exact-values -----------------------------------------------------------------------------------------

/** The global constructors whose `expect.any(...)` accepts every value of a kind, so asserts nothing exact. */
const LOOSE_KINDS = new Set(["String", "Number", "Date"])

/** A unit spec asserts the exact id and the exact date, never "some string" or "some date". */
export const specExactValues = {
    meta: {
        type: "problem",
        docs: { description: "A logic-role unit spec never asserts `expect.any(String)`, `expect.any(Number)` or `expect.any(Date)`: ids and clocks come from `fakeIds()` and `FakeClock`, so the exact value is asserted." },
        schema: [],
        messages: {
            loose: "[BE_SPEC_FORM_ALL_ROLES] `expect.any({{kind}})` accepts every {{what}}, so the assertion proves nothing about the value the subject generated. The subject takes its ids and its clock from tokens and the spec provides the kit's deterministic doubles: `{ provide: ID_GENERATOR, useValue: fakeIds() }` and `{ provide: CLOCK, useValue: new FakeClock(...) }` from `@starci/jest-preset`. Assert the exact value ({{exact}}).",
        },
    },
    create(context) {
        if (!isFormSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.property.name !== "any") return
                if (!isAmbientOrImported(context, callee.object, "expect", "@jest/globals")) return
                const kind = node.arguments[0]
                if (kind?.type !== "Identifier" || !LOOSE_KINDS.has(kind.name) || !isAmbientOrImported(context, kind, kind.name, null)) return
                const what = { String: "string", Number: "number", Date: "date" }[kind.name]
                const exact = kind.name === "Date" ? "the clock's date, for example `clock.now()` of the `FakeClock` the spec provides" : "the id the `fakeIds()` double hands out"
                context.report({ node, messageId: "loose", data: { kind: kind.name, what, exact } })
            },
        }
    },
}

// -- spec-behavior-assertion -----------------------------------------------------------------------------------

const PRESENCE_MATCHERS = new Set(["toBeDefined", "toBeTruthy"])

/** The matcher in `expect(value).not.resolves.toEqual(...)`, or null for another receiver. */
const matcherOf = (context, node) => {
    const callee = node.callee
    if (callee.type !== "MemberExpression") return null
    const matcher = callee.computed ? callee.property.value : callee.property.name
    if (typeof matcher !== "string" || !matcher.startsWith("to")) return null
    let receiver = callee.object
    while (receiver.type === "MemberExpression") receiver = receiver.object
    if (receiver.type !== "CallExpression") return null
    if (!isImportedFrom(context, receiver.callee, "@jest/globals", "expect") && !isAmbientOrImported(context, receiver.callee, "expect", "@jest/globals")) return null
    return matcher
}

const TEST_MODIFIERS = new Set(["only", "skip", "concurrent", "failing", "each"])

/** A Jest test registration, including modifiers and both forms of `each`. */
const isTestFunction = (context, node) => {
    if (!node) return false
    if (isImportedFrom(context, node, "@jest/globals", ["it", "test"])) return true
    if (isAmbientOrImported(context, node, "it", "@jest/globals") || isAmbientOrImported(context, node, "test", "@jest/globals")) return true
    if (node.type === "MemberExpression" && TEST_MODIFIERS.has(keyName(node.property))) return isTestFunction(context, node.object)
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && keyName(node.callee.property) === "each") return isTestFunction(context, node.callee.object)
    if (node.type === "TaggedTemplateExpression" && node.tag.type === "MemberExpression" && keyName(node.tag.property) === "each") return isTestFunction(context, node.tag.object)
    return false
}

/** The local value an identifier binds, when it can name a callback or assertion helper. */
const functionBinding = (context, node) => {
    for (let scope = context.sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(node.name)
        if (!variable) continue
        const definition = variable.defs[0]
        if (definition?.type === "FunctionName") return definition.node
        if (definition?.type === "Variable") return definition.node.init
        return null
    }
    return null
}

/** An inline function or a locally bound function, following aliases without cycles. */
const functionOf = (context, expression) => {
    let node = peel(expression)
    const seen = new Set()
    while (node?.type === "Identifier") {
        if (seen.has(node)) return null
        seen.add(node)
        node = peel(functionBinding(context, node))
    }
    if (!node) return null
    return ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(node.type) ? node : null
}

/** Assertions in the callback's executed syntax, including local helpers and passed callbacks. */
const hasAssertion = (context, fn, seen = new Set()) => {
    if (seen.has(fn)) return false
    seen.add(fn)
    let found = false
    walk(fn.body, (node) => {
        if (found || node.type !== "CallExpression") return
        if (matcherOf(context, node) !== null) {
            found = true
            return
        }
        if (isTestFunction(context, node.callee)) return
        const functions = [node.callee, ...node.arguments].map((expression) => functionOf(context, expression)).filter(Boolean)
        found = functions.some((helper) => hasAssertion(context, helper, seen))
    }, { intoFunctions: false })
    return found
}

/** Presence alone does not prove the behavior of a logic-role subject. */
export const specBehaviorAssertion = {
    meta: {
        type: "problem",
        docs: { description: "Every logic-role unit test has an assertion, and its spec asserts behavior beyond presence or truthiness (R281 BE_SPEC_FORM_ALL_ROLES)." },
        schema: [],
        messages: {
            presenceOnly: "[BE_SPEC_FORM_ALL_ROLES] Every assertion in this spec checks only presence or truthiness. Assert an exact result, error or observable effect of the subject's behavior.",
            zeroAssertions: "[BE_SPEC_FORM_ALL_ROLES] This unit test has no assertion. Assert an exact result, error or observable effect of the subject's behavior in every `it`/`test` callback.",
        },
    },
    create(context) {
        if (!isFormSpecFile(hfsOf(context), context.filename || context.getFilename())) return {}
        let firstPresence = null
        let behavior = false
        return {
            CallExpression(node) {
                if (isTestFunction(context, node.callee)) {
                    const callback = functionOf(context, node.arguments[1])
                    if (callback !== null && !hasAssertion(context, callback)) context.report({ node, messageId: "zeroAssertions" })
                }
                const matcher = matcherOf(context, node)
                if (matcher === null) return
                if (PRESENCE_MATCHERS.has(matcher)) firstPresence ??= node
                else behavior = true
            },
            "Program:exit"() {
                if (firstPresence !== null && !behavior) context.report({ node: firstPresence, messageId: "presenceOnly" })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "spec-builds-with-testing-module": specBuildsWithTestingModule,
    "spec-no-new-subject": specNoNewSubject,
    "spec-module-definition-only-providers": specModuleDefinitionOnlyProviders,
    "spec-no-module-mock": specNoModuleMock,
    "no-return-only-generic": noReturnOnlyGeneric,
    "spec-infra-double-from-kit": specInfraDoubleFromKit,
    "spec-exact-values": specExactValues,
    "spec-behavior-assertion": specBehaviorAssertion,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/spec-builds-with-testing-module": "error",
    "starci-be/spec-no-new-subject": "error",
    "starci-be/spec-module-definition-only-providers": "error",
    "starci-be/spec-no-module-mock": "error",
    "starci-be/no-return-only-generic": "error",
    "starci-be/spec-infra-double-from-kit": "error",
    "starci-be/spec-exact-values": "error",
    "starci-be/spec-behavior-assertion": "error",
}
