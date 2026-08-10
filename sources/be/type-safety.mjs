/**
 * The rules that hold `type-safety.md`.
 *
 * Three house rules plus two standard ones, and the split is worth knowing. `no-explicit-any` and
 * the array-type spelling already exist in the TypeScript plugin and are named in `recommended`
 * rather than reimplemented -- a second implementation of a rule everybody has is a maintenance
 * cost with no gain.
 *
 * What is house-written is what the standard set does not cover: the double cast (TYPE-2), the
 * inline parameter type (TYPE-3) and the const enum (TYPE-4). Each is a way of switching the
 * compiler off that looks locally reasonable, which is exactly the class a rule is for.
 *
 * TYPE-5 is not enforced. Whether a set of booleans describes ONE situation or several genuinely
 * independent ones needs to know what the code means, and a rule that guessed would fire on every
 * struct with two flags in it.
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-double-cast": noDoubleCast,
  "no-inline-param-type": noInlineParamType,
  "no-const-enum": noConstEnum,
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
 */
export const recommended = {
  "starci-be/no-double-cast": "error",
  "starci-be/no-inline-param-type": "error",
  "starci-be/no-const-enum": "error",
  "@typescript-eslint/no-explicit-any": "error",
  "@typescript-eslint/array-type": ["error", {
    default: "generic",
    readonly: "generic",
  }],
}
