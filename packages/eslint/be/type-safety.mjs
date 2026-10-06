/**
 * The rules that hold the type-safety law (catalog R72 `BE_TYPE_ESCAPE` and the type-shape rows).
 *
 * WHAT THE FACTORY BORROWS, SO THIS FILE DOES NOT REIMPLEMENT IT. `starciBeConfig` turns on, at `error`, in every file
 * of the repository and with no lane of exemption (a spec, a fixture and an e2e setup file get the same law):
 * `@typescript-eslint/consistent-type-assertions` with `assertionStyle: "never"` (no `x as T`, no `<T>x`, hence no
 * `as never`, no `as unknown as T`, no cast out of an `unknown` value; only `as const` stays),
 * `@typescript-eslint/no-non-null-assertion` (no `x!`) and `@typescript-eslint/no-explicit-any`. One obligation, one
 * rule: this canon writes no second copy of any of them, so the four house rules that once restated them
 * (`no-never-cast`, `no-non-null-assertion`, `no-double-cast`, `no-unguarded-unknown-cast`) are deleted.
 *
 * What is house-written is what the borrowed set does not cover: `Function` as a type and `eval` (R72), the inline
 * parameter type and the inline object type in every other position (TYPE-3), the const enum (TYPE-4) and the
 * handler return type (R75).
 *
 * TYPE-5 (the boolean-flag product) is NOT among them, and that absence was tested rather than assumed: a rule was
 * written, measured against the reference backend and withdrawn because both of its real firings were wrong. It stays
 * a reader's job, exactly as the law's own `Layer held` table says.
 */

/** A parameter property (`private readonly x: T`) wraps the parameter it declares. */
const unwrapParam = (param) => (param.type === "TSParameterProperty" ? param.parameter : param)

// -- TYPE-3 ----------------------------------------------------------------------------------------

/** A destructured parameter's type is named, so a second caller can reference it. */
export const noInlineParamType = {
  meta: {
    type: "problem",
    docs: { description: "A destructured parameter takes a named type, not an inline literal." },
    schema: [],
    messages: {
      inline:
        "An inline object type on a destructured parameter cannot be referenced, imported or extended - so the second caller writes it again, and when a third field arrives only one of the two copies gets it. Move it to a named interface in the module's `types/`.",
    },
  },
  create(context) {
    const check = (params) => {
      for (const raw of params || []) {
        const param = unwrapParam(raw)
        if (param.type !== "ObjectPattern" || !param.typeAnnotation) continue
        const annotation = param.typeAnnotation.typeAnnotation
        if (annotation?.type === "TSTypeLiteral") {
          context.report({ node: param.typeAnnotation, messageId: "inline" })
        }
      }
    }
    return {
      FunctionDeclaration(node) {
        check(node.params)
      },
      FunctionExpression(node) {
        check(node.params)
      },
      ArrowFunctionExpression(node) {
        check(node.params)
      },
    }
  },
}

// -- TYPE-3, extended (law 4) ------------------------------------------------------------------------

/**
 * `no-inline-param-type` holds only the destructured-parameter half of law 4: "a destructured
 * parameter's type has a name and a home a second caller can import from." The same sentence, read
 * without the word "destructured", covers every inline object type -- a positional parameter, a
 * property signature, a function return, a variable -- because the failure is identical in all four:
 * the shape cannot be referenced, imported or extended, so a second site retypes it and the two
 * copies drift apart in silence.
 *
 * Three things are deliberately left alone, and each is a different reason:
 *
 * - An EMPTY `{}` means "no properties", not "an unnamed shape". That is a different smell (the
 *   fix is a stricter type, not a name) and this rule does not touch it.
 * - A type literal inside a `declare module` / module augmentation describes a vendor's own shape.
 *   It cannot be pulled into a named type this repository owns without the two drifting the moment
 *   the vendor changes theirs, so the ambient lane is out of scope.
 * - A type literal that is already the right-hand side of a named type alias (`type Foo = { ... }`)
 *   IS the fix this rule asks for. Flagging it would make the rule unsatisfiable -- there would be no
 *   way to hold an object type by name that this rule accepted. A type literal declared elsewhere is
 *   still checked in the ordinary way; only the exact node a type alias names is exempt.
 */

/** A type literal with no members means "no properties" -- a different smell with a different fix. */
const isEmptyTypeLiteral = (typeLiteral) => !typeLiteral.members || typeLiteral.members.length === 0

/** A vendor's own declaration lives in a `declare module` / module augmentation and cannot be named separately. */
const isInsideAmbientModule = (node) => {
  let current = node.parent
  while (current) {
    if (current.type === "TSModuleDeclaration" && current.declare) return true
    current = current.parent
  }
  return false
}

/** The non-empty inline object type at `typeAnnotation.typeAnnotation`, or null if this is out of scope. */
const inlineObjectTypeOf = (typeAnnotation, scopeNode) => {
  if (!typeAnnotation) return null
  const literal = typeAnnotation.typeAnnotation
  if (literal?.type !== "TSTypeLiteral") return null
  if (isEmptyTypeLiteral(literal)) return null
  if (isInsideAmbientModule(scopeNode)) return null
  return literal
}

export const noInlineObjectType = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A TypeScript object type written inline takes a named type instead, in every position (TYPE-3, law 4).",
    },
    schema: [],
    messages: {
      inlineObjectType:
        "This inline object type ({{position}}) cannot be referenced, imported or extended, so a second site retypes it and the two copies drift apart in silence the moment a third field arrives on only one of them. Give it a name in the module's `types/` and reference that name here instead.",
    },
  },
  create(context) {
    const reportLiteral = (node, position) => {
      context.report({ node, messageId: "inlineObjectType", data: { position } })
    }

    const checkParams = (fnNode) => {
      for (const raw of fnNode.params || []) {
        const param = unwrapParam(raw)
        if (inlineObjectTypeOf(param.typeAnnotation, param)) {
          reportLiteral(param.typeAnnotation, "parameter")
        }
      }
    }

    const checkReturnType = (fnNode) => {
      if (inlineObjectTypeOf(fnNode.returnType, fnNode)) {
        reportLiteral(fnNode.returnType, "return type")
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node)
        checkReturnType(node)
      },
      FunctionExpression(node) {
        checkParams(node)
        checkReturnType(node)
      },
      ArrowFunctionExpression(node) {
        checkParams(node)
        checkReturnType(node)
      },
      TSPropertySignature(node) {
        if (inlineObjectTypeOf(node.typeAnnotation, node)) {
          reportLiteral(node.typeAnnotation, "property signature")
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier") return
        if (inlineObjectTypeOf(node.id.typeAnnotation, node)) {
          reportLiteral(node.id.typeAnnotation, "variable")
        }
      },
    }
  },
}

// -- TYPE-4 ----------------------------------------------------------------------------------------

/** An enum keeps its runtime object. */
export const noConstEnum = {
  meta: {
    type: "problem",
    docs: { description: "Enums are declared plain, never `const enum`." },
    schema: [],
    messages: {
      constEnum:
        "`const enum {{name}}` is inlined at compile time and has no runtime object: it cannot be iterated, cannot be reverse-mapped, and cannot cross the isolated-modules boundary this repository compiles under. It saves a few bytes and costs a family of things that simply do not work. Declare a plain `enum`.",
    },
  },
  create(context) {
    return {
      TSEnumDeclaration(node) {
        if (!node.const) return
        context.report({ node, messageId: "constEnum", data: { name: node.id.name } })
      },
    }
  },
}

// -- R72 -------------------------------------------------------------------------------------------

/** A global name (`Function`, `eval`) that no declaration of this file shadows. */
const isGlobalName = (context, node, name) => {
  let scope = (context.sourceCode || context.getSourceCode()).getScope(node)
  while (scope) {
    const variable = scope.set.get(name)
    if (variable) return variable.defs.length === 0
    scope = scope.upper
  }
  return true
}

/** `Function` as a type, `eval` and `new Function` run or accept code the compiler cannot see. */
export const noFunctionOrEval = {
  meta: {
    type: "problem",
    docs: { description: "No `Function` type, no `eval`, no `new Function` (the type escapes the borrowed assertion rules do not cover)." },
    schema: [],
    messages: {
      functionType:
        "The `Function` type accepts any callable and returns `any`, so the compiler stops checking every call through it. Write the signature: `(input: Input) => Result`.",
      evaluated:
        "`{{name}}` builds code from a string, which the compiler cannot type and a reader cannot follow. Call a real function, or map a key to a function in a typed record.",
    },
  },
  create(context) {
    return {
      TSTypeReference(node) {
        if (node.typeName.type === "Identifier" && node.typeName.name === "Function" && isGlobalName(context, node, "Function")) {
          context.report({ node, messageId: "functionType" })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "Identifier" || (callee.name !== "eval" && callee.name !== "Function")) return
        if (isGlobalName(context, node, callee.name)) context.report({ node, messageId: "evaluated", data: { name: callee.name } })
      },
      NewExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "Function" && isGlobalName(context, node, "Function")) {
          context.report({ node, messageId: "evaluated", data: { name: "new Function" } })
        }
      },
    }
  },
}

// -- R75 -------------------------------------------------------------------------------------------

const HANDLER_DECORATORS = new Set(["Query", "Mutation", "Subscription", "ResolveField", "Get", "Post", "Put", "Patch", "Delete", "MessagePattern", "EventPattern", "Cron", "Interval"])
const SURFACE_CLASS_DECORATORS = new Set(["Injectable", "Resolver", "Controller"])

const decoratorIdentifier = (decorator) => {
  const expression = decorator?.expression
  if (!expression) return null
  if (expression.type === "Identifier") return expression.name
  if (expression.type === "CallExpression" && expression.callee.type === "Identifier") return expression.callee.name
  return null
}

/** A method that a caller or the framework reaches states what it returns. */
export const explicitHandlerReturnType = {
  meta: {
    type: "problem",
    docs: { description: "Handlers and public methods of an Injectable, Resolver or Controller declare a return type." },
    schema: [],
    messages: {
      handler:
        "This handler declares no return type, so the transport contract is whatever the body happens to return today and a change of the body silently changes the wire. Declare the return type (`Promise<Type>`).",
      publicMethod:
        "This public method declares no return type, so its callers depend on an inferred shape that changes with the body. Declare the return type.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (node.kind !== "method" || node.static || !node.value.body || node.value.returnType) return
        if (node.computed || node.key.type !== "Identifier") return
        const isHandler = (node.decorators ?? []).some((decorator) => HANDLER_DECORATORS.has(decoratorIdentifier(decorator)))
        if (isHandler) {
          context.report({ node: node.key, messageId: "handler" })
          return
        }
        if (node.accessibility === "private" || node.accessibility === "protected" || node.override) return
        const klass = node.parent?.parent
        if (klass?.type !== "ClassDeclaration") return
        const exported = klass.parent?.type === "ExportNamedDeclaration" || klass.parent?.type === "ExportDefaultDeclaration"
        const decorators = [...(klass.decorators ?? []), ...(klass.parent?.decorators ?? [])].map(decoratorIdentifier)
        if (!exported || !decorators.some((name) => SURFACE_CLASS_DECORATORS.has(name))) return
        context.report({ node: node.key, messageId: "publicMethod" })
      },
    }
  },
}

// -- TYPE-5 (rule 6) -- ATTEMPTED, NOT SHIPPED ------------------------------------------------------
//
// A rule was written here: two-or-more `is`/`has`-prefixed booleans sharing a type literal with a
// field that is optional and not itself boolean. It was measured against the reference backend
// before shipping, per this canon's own standard -- and both of its two real firings were wrong.
// `GlobalSearchItem` (`isEnrolled` / `isFree` / `isPremium` beside an unrelated optional
// `parentPath`) and `AdvertisementSeedItem` (`isHouseAd` / `isActive` beside an unrelated optional
// `ctaText`) are both genuinely independent facts about one entity, not a product of states -- the
// exact "transport type" and "independent booleans" exceptions `type-safety.md` already names. A
// rule reporting a defect on 2 of its 2 real firings is not a rule with debt to burn down; it is
// wrong, and shipping it at any level would teach a reader to distrust the machine rather than the
// code. TYPE-5 stays `documented`, exactly as the law's own `Layer held` table already says: seeing
// past a transport DTO to whether its flags are truly one situation needs the meaning of the code,
// which is a reader's job, not a decidable question of syntax.

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-function-or-eval": noFunctionOrEval,
  "no-inline-param-type": noInlineParamType,
  "no-inline-object-type": noInlineObjectType,
  "no-const-enum": noConstEnum,
  "explicit-handler-return-type": explicitHandlerReturnType,
}

/**
 * The level this law asks for: every rule at `error`, in every file, specs included.
 *
 * The borrowed type-escape rules (`consistent-type-assertions` never, `no-non-null-assertion`, `no-explicit-any`)
 * are added by the factory (`lib/config.mjs`), not listed here. The array spelling rule stays with this law.
 */
export const recommended = {
  "starci-be/no-function-or-eval": "error",
  "starci-be/no-inline-param-type": "error",
  "starci-be/no-inline-object-type": "error",
  "starci-be/no-const-enum": "error",
  "starci-be/explicit-handler-return-type": "error",
}
