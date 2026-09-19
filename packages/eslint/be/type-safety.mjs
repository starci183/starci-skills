/**
 * The rules that hold `type-safety.md`.
 *
 * Six house rules plus two standard ones, and the split is worth knowing. `no-explicit-any` and
 * the array-type spelling already exist in the TypeScript plugin and are named in `recommended`
 * rather than reimplemented -- a second implementation of a rule everybody has is a maintenance
 * cost with no gain. Rule 1 (`any` in a declaration, cast target or generic argument) is exactly
 * that rule; a house-written twin of `no-explicit-any` would be the two-homes-for-one-law failure
 * this canon exists to prevent, so rule 1 is deliberately not reimplemented here.
 *
 * What is house-written is what the standard set does not cover: the double cast (TYPE-2, rule 3),
 * the inline parameter type (TYPE-3, rule 4), the inline object type in every other position --
 * property, return, variable -- that rule 4 names once it is read without the word "destructured"
 * (TYPE-3, rule 4, extended; see the export below for its `recommended` level and the measurement
 * that set it), the const enum
 * (TYPE-4, rule 5), the unguarded cast off an `unknown` value (TYPE-1's second half, rule 2), and
 * the per-line suppression standing in for a lane (TYPE-6, rule 7). Each is a way of switching the
 * compiler off -- or of leaving it turned further down than the law asks -- that looks locally
 * reasonable, which is exactly the class a rule is for.
 *
 * TYPE-5 (rule 6, the boolean-flag product) is NOT among them, and that absence was tested rather
 * than assumed. See the comment where TYPE-5 would sit, below, for what was tried and why it was
 * withdrawn after being measured against the reference backend.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The spec family and the test tree may build a deliberately wrong value on purpose. */
const isTestFile = (filename) => {
  const file = normalizePath(filename)
  return /\.(?:spec|test|e2e-spec|int-spec|harness-spec)\.ts$/.test(file) || file.includes("/src/tests/")
}

/** A parameter property (`private readonly x: T`) wraps the parameter it declares. */
const unwrapParam = (param) => (param.type === "TSParameterProperty" ? param.parameter : param)

// -- TYPE-2 ----------------------------------------------------------------------------------------

/** A cast through `unknown` is the compiler being overruled twice. */
export const noDoubleCast = {
  meta: {
    type: "problem",
    docs: { description: "No `x as unknown as T` outside the test lanes." },
    schema: [],
    messages: {
      doubleCast:
        "`as unknown as` is the compiler saying these types do not overlap, and being overruled twice. It is worse than `any` in one specific way: the result CLAIMS to be the target type, so everything downstream trusts it completely and the failure surfaces far from this line. Fix the type, or narrow with a guard that actually checks.",
    },
  },
  create(context) {
    if (isTestFile(context.filename || context.getFilename())) return {}
    return {
      TSAsExpression(node) {
        // the OUTER cast of the pair: its operand is itself a cast, to `unknown`
        const inner = node.expression
        if (!inner || inner.type !== "TSAsExpression") return
        const innerType = inner.typeAnnotation
        if (!innerType || innerType.type !== "TSUnknownKeyword") return
        context.report({ node, messageId: "doubleCast" })
      },
    }
  },
}

// -- TYPE-1, second half (rule 2) -------------------------------------------------------------------

/** typeof/instanceof/in/null-equality/Array.isArray are the sanctioned ways to narrow an `unknown`. */
const isNullOrUndefinedLiteral = (node) =>
  (node.type === "Literal" && node.value === null) || (node.type === "Identifier" && node.name === "undefined")

/** The nearest enclosing function, so narrowing found in one function never covers another. */
const enclosingFunction = (node) => {
  let current = node.parent
  while (current) {
    if (
      current.type === "FunctionDeclaration"
      || current.type === "FunctionExpression"
      || current.type === "ArrowFunctionExpression"
    ) {
      return current
    }
    current = current.parent
  }
  return null
}

/** Whether a parameter or variable is explicitly declared `: unknown` at the point it enters. */
const isUnknownAnnotation = (typeAnnotation) =>
  !!typeAnnotation && !!typeAnnotation.typeAnnotation && typeAnnotation.typeAnnotation.type === "TSUnknownKeyword"

/**
 * A value declared `unknown` is cast straight to a concrete type with no visible check first.
 *
 * `unknown` refuses every operation until narrowed -- except a cast, which TypeScript allows
 * FREELY from `unknown` to anything, no guard required. `no-double-cast` catches the pair that
 * launders a wrong type through `unknown`; it does not catch a single cast that starts already
 * `unknown` and asserts straight past the type system with nothing behind it. That gap is TYPE-1's
 * second half: the law asks for "unknown, narrowed exactly once, visibly", and a bare cast narrows
 * nothing -- it only claims to.
 *
 * Scoped to identifiers explicitly annotated `unknown` (a parameter or a `const x: unknown`), and
 * to narrowing found anywhere earlier in the SAME enclosing function -- not a full control-flow
 * proof, because this plugin carries no type information to build one. The forms it accepts as
 * narrowing are `typeof`, `instanceof`, `in`, a null/undefined equality check, and -- deliberately
 * loose -- passing the value into ANY function call, because the law names "a predicate" beside
 * `typeof`/`instanceof` and a custom guard is exactly that predicate; this rule cannot read what
 * is inside the call, so it trusts that a call taking the value is a check on it. That looseness
 * trades missed gaps for avoided false positives on purpose. The test lanes are exempt for the
 * same reason `no-double-cast` exempts them: a harness helper that hands a caller-supplied
 * generic type back unchecked (`nextMessage<TPayload>`) is deliberate, not a gap. Measured against
 * the reference backend, this rule still stays at `warn` -- the debt is real and small enough to
 * burn down, not yet zero.
 */
export const noUnguardedUnknownCast = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A value declared `unknown` is narrowed by a visible check before it is cast to a concrete type (TYPE-1, law 2).",
    },
    schema: [],
    messages: {
      unguarded:
        "`{{name}}` entered as `unknown` and is cast straight to `{{target}}` with no `typeof`, `instanceof`, `in` or null check on `{{name}}` anywhere earlier in this function. A cast out of `unknown` is unrestricted by design -- TypeScript will not stop you -- so the check has to be the thing that stops you. Add one before the cast: `typeof {{name}} === \"...\"`, `{{name}} instanceof ...`, or `{{name}} !== null`.",
    },
  },
  create(context) {
    // the harness lane builds generic pass-through helpers on purpose (`nextMessage<TPayload>`
    // handing back whatever the event bus produced as the caller's declared type) -- the same
    // "deliberately unchecked on purpose" property TYPE-2 already carves the test lanes out for
    if (isTestFile(context.filename || context.getFilename())) return {}
    const sourceCode = context.sourceCode || context.getSourceCode()
    const trackedByScope = new Map()
    const narrowedByScope = new Map()
    const scopeKey = (node) => enclosingFunction(node) || "module"

    const track = (name, scope) => {
      if (!trackedByScope.has(scope)) trackedByScope.set(scope, new Set())
      trackedByScope.get(scope).add(name)
    }
    const markNarrowed = (name, scope) => {
      if (!narrowedByScope.has(scope)) narrowedByScope.set(scope, new Set())
      narrowedByScope.get(scope).add(name)
    }

    const checkParams = (fnNode) => {
      for (const raw of fnNode.params) {
        const param = unwrapParam(raw)
        if (param.type === "Identifier" && isUnknownAnnotation(param.typeAnnotation)) {
          track(param.name, fnNode)
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node)
      },
      FunctionExpression(node) {
        checkParams(node)
      },
      ArrowFunctionExpression(node) {
        checkParams(node)
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && isUnknownAnnotation(node.id.typeAnnotation)) {
          track(node.id.name, scopeKey(node))
        }
      },
      UnaryExpression(node) {
        if (node.operator !== "typeof") return
        if (node.argument.type !== "Identifier") return
        markNarrowed(node.argument.name, scopeKey(node))
      },
      BinaryExpression(node) {
        if (node.operator === "instanceof") {
          if (node.left.type === "Identifier") markNarrowed(node.left.name, scopeKey(node))
          return
        }
        if (node.operator === "in") {
          if (node.right.type === "Identifier") markNarrowed(node.right.name, scopeKey(node))
          return
        }
        if (!["===", "!==", "==", "!="].includes(node.operator)) return
        if (node.left.type === "Identifier" && isNullOrUndefinedLiteral(node.right)) {
          markNarrowed(node.left.name, scopeKey(node))
        }
        if (node.right.type === "Identifier" && isNullOrUndefinedLiteral(node.left)) {
          markNarrowed(node.right.name, scopeKey(node))
        }
      },
      CallExpression(node) {
        // any predicate call that TAKES the value narrows it, the same way `typeof` does -- the
        // law names "a predicate" beside `typeof`/`instanceof` on purpose, and a custom guard
        // (`this.isPlainObject(current)`, `Array.isArray(value)`) is exactly that predicate. This
        // side is deliberately loose: the cost of missing a real gap here is smaller than the cost
        // of flagging a guard this rule cannot read the inside of.
        for (const arg of node.arguments) {
          if (arg.type === "Identifier") markNarrowed(arg.name, scopeKey(node))
        }
      },
      TSAsExpression(node) {
        if (node.expression.type !== "Identifier") return
        const name = node.expression.name
        const scope = scopeKey(node)
        if (!trackedByScope.get(scope) || !trackedByScope.get(scope).has(name)) return
        const target = node.typeAnnotation
        if (target && target.type === "TSUnknownKeyword") return
        if (narrowedByScope.get(scope) && narrowedByScope.get(scope).has(name)) return
        context.report({
          node,
          messageId: "unguarded",
          data: { name, target: sourceCode.getText(target) },
        })
      },
    }
  },
}

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
        if (annotation && annotation.type === "TSTypeLiteral") {
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
 *   the vendor changes theirs, so the ambient lane is out of scope the same way the test lanes are.
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
  if (!literal || literal.type !== "TSTypeLiteral") return null
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
    if (isTestFile(context.filename || context.getFilename())) return {}

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

// -- TYPE-6 (rule 7) ----------------------------------------------------------------------------------

/** This law's own published rule names -- the only ones this rule polices. */
const TYPE_SAFETY_RULE_NAMES = [
  "no-double-cast",
  "no-inline-param-type",
  "no-inline-object-type",
  "no-const-enum",
  "no-unguarded-unknown-cast",
]

const DISABLE_DIRECTIVE = /^eslint-disable(?:-next-line|-line)?\b/

/**
 * A sanctioned exit is declared at the lane, once -- not suppressed per line.
 *
 * `no-double-cast`'s test-lane exemption already lives in `isTestFile`, consulted once, so every
 * place the exit is in force is derivable from that one function. A per-line `eslint-disable` for
 * any rule this law publishes is therefore never the lane speaking -- it is either redundant (the
 * lane already covers the file) or an undeclared second exit (the file needed one and reached for
 * a comment instead of a lane). Either way `type-safety.md` names this exact failure: "a per-line
 * suppression standing in for a lane-wide exit".
 *
 * Deliberately scoped to only the five rule names this law publishes -- a rule that policed every
 * `eslint-disable` in the repository would be reaching into every other family's lane, which is
 * outside this file's boundary.
 */
export const noLineSuppression = {
  meta: {
    type: "problem",
    docs: {
      description:
        "No inline `eslint-disable` for a type-safety rule; the lane is the only sanctioned exit (TYPE-6, law 7).",
    },
    schema: [],
    messages: {
      suppression:
        "This comment disables `starci-be/{{name}}` on one line. That rule's only sanctioned exit is declared once, at the lane, inside the rule itself -- a per-line suppression is never that declaration, it is a stand-in for one. Delete the comment; if the file genuinely needs the exemption, it belongs in the lane the rule already recognizes.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode()
    return {
      "Program:exit"(node) {
        for (const comment of sourceCode.getAllComments()) {
          const text = comment.value.trim()
          if (!DISABLE_DIRECTIVE.test(text)) continue
          const named = TYPE_SAFETY_RULE_NAMES.find((name) => text.includes(`starci-be/${name}`))
          if (!named) continue
          context.report({ node: comment ?? node, messageId: "suppression", data: { name: named } })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-double-cast": noDoubleCast,
  "no-inline-param-type": noInlineParamType,
  "no-inline-object-type": noInlineObjectType,
  "no-const-enum": noConstEnum,
  "no-unguarded-unknown-cast": noUnguardedUnknownCast,
  "no-line-suppression": noLineSuppression,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * The two standard rules are listed beside the house ones so a consuming repository switches the
 * set on together -- `no-explicit-any` in particular is the one everybody already has and the one
 * whose absence makes the rest decorative.
 *
 * The test exit for `no-double-cast` is inside the rule rather than in a config glob, because
 * building a deliberately wrong value is how a spec proves a closed API refuses it, and that is a
 * property of the lane rather than of any repository's file layout.
 *
 * `no-inline-object-type` was published at `"off"`, not `"error"` or `"warn"` like its siblings, until
 * it was measured against the reference backend. The gate this package ships (`index.test.mjs`)
 * requires every published rule to carry a level, so `"off"` -- not absence -- was how the rule stayed
 * registered and switched-off at once: present for a consuming repository to opt into deliberately,
 * silent until the owner had the debt count in hand.
 *
 * That measurement is done: an ESLint Linter-API run, per file, across every file the reference
 * backend's own `eslint.config.mjs` lints (`src/**`, `apps/**`, `libs/**`, `test/**`, `tests/**` --
 * 4,738 files at measurement time) found zero remaining product-code fires once the three real
 * ones (two in `apps/mock/src/main.ts`, one in `apps/playground-rag-agent/src/rag-agent.service.ts`,
 * plus a fourth the same sweep turned up in `src/modules/ai/utils/extract-json-block.ts` that an
 * earlier pass had missed) were each given a named type. The rule's own test-file exemption held
 * throughout: every other hit was inside `*.spec.ts`. Zero debt is exactly the condition this
 * canon's own convention requires before a rule moves from `off` to `error` -- the same standard
 * `no-unguarded-unknown-cast` is still waiting to clear before its own `warn` becomes `error`.
 */
export const recommended = {
  "starci-be/no-double-cast": "error",
  "starci-be/no-inline-param-type": "error",
  "starci-be/no-inline-object-type": "error",
  "starci-be/no-const-enum": "error",
  "starci-be/no-unguarded-unknown-cast": "warn", // no=3 -- see type-safety.mjs's doc comment
  "starci-be/no-line-suppression": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/array-type": ["error", {
    default: "generic",
    readonly: "generic",
  }],
}
