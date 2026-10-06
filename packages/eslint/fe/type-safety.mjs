/**
 * The rules that hold `type-safety.md`.
 *
 * FOUR RULES, ONE IDEA: the compiler is told the truth or it is not told at all. The double cast, the
 * plain assertion, the non-null assertion and `any` are the four spellings of "trust me". They live
 * here rather than in a repository's own `eslint.config.mjs` because a repository carries no rule of
 * its own: a rule that exists only in one repository's config is a rule the next repository forgets.
 * The array spelling is a formatting question and stays with the formatter.
 *
 * THE EXEMPTION IS A SPEC, and it has to be. Proving a closed API refuses bad input means building
 * bad input, and there is no way to construct a value the types forbid without telling the compiler
 * to forget them. A judgement-based exemption would be argued at every call site; a spec is decided
 * once, by its name.
 */

import { isProductSource } from "./lib/scope.mjs"

/** True when a type node is the `unknown` keyword. */
const isUnknown = (node) => Boolean(node) && node.type === "TSUnknownKeyword"

// -- TYPE-SAFETY-1 ---------------------------------------------------------------------------------

/** A cast through `unknown` erases what the compiler knew, at the seam where it mattered. */
export const noDoubleCast = {
  meta: {
    type: "problem",
    docs: { description: "No cast through `unknown`; it turns checking off at the boundary." },
    schema: [],
    messages: {
      double:
        "Casting through `unknown` tells the compiler to forget everything it knew about this value, because the two types have nothing in common. That is not a narrowing - a narrowing is a claim the compiler can still partly check - it is an erasure, and the seam it erases is the one worth checking: where a value crosses from outside the program to inside it. Narrow from `unknown` with a check the compiler can follow, or fix the shape.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    return {
      TSAsExpression(node) {
        // The outer cast of a `x as unknown as T` pair: its operand is itself a cast to `unknown`.
        const inner = node.expression
        if (inner?.type !== "TSAsExpression") return
        if (!isUnknown(inner.typeAnnotation)) return
        context.report({ node, messageId: "double" })
      },
    }
  },
}

// -- TYPE-SAFETY-2 ---------------------------------------------------------------------------------

/** True for `as const`, the one assertion that narrows without claiming anything. */
const isConstAssertion = (type) => type.type === "TSTypeReference" && type.typeName.type === "Identifier" && type.typeName.name === "const"

/**
 * A type assertion is a claim the compiler cannot check, made at the place it was going to check.
 *
 * WHAT IS LEFT ALLOWED. `as const` (it narrows), `as unknown` (it widens, and everything is assignable
 * to it), and `satisfies` (it checks). The cast through `unknown` to a real type is refused by
 * `no-double-cast`, so this rule leaves the outer half of that pair to it and reports each once.
 */
export const noTypeAssertion = {
  meta: {
    type: "problem",
    docs: { description: "No `as T` or `<T>x`; narrow with a check, a guard or a parser." },
    schema: [],
    messages: {
      assertion:
        "`as {{type}}` tells the compiler to believe something it could not verify. When the claim is wrong the type system keeps saying it is right and the failure moves to a reader. Narrow with a check the compiler can follow (a type guard, `in`, a discriminant), parse the value where it enters, or use `satisfies` when the goal is only to check a literal.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    const report = (node) =>
      context.report({ node, messageId: "assertion", data: { type: source.getText(node.typeAnnotation) } })
    return {
      TSAsExpression(node) {
        if (isConstAssertion(node.typeAnnotation) || isUnknown(node.typeAnnotation)) return
        const inner = node.expression
        if (inner?.type === "TSAsExpression" && isUnknown(inner.typeAnnotation)) return
        report(node)
      },
      TSTypeAssertion(node) {
        if (isConstAssertion(node.typeAnnotation)) return
        report(node)
      },
    }
  },
}

// -- TYPE-SAFETY-3 ---------------------------------------------------------------------------------

/** `x!` says a value is present without proving it. */
export const noNonNullAssertion = {
  meta: {
    type: "problem",
    docs: { description: "No non-null assertion (`x!`); prove the value is there." },
    schema: [],
    messages: {
      bang:
        "`!` asserts the value is not null or undefined and proves nothing: the day it is one, the failure is a TypeError in a reader's browser rather than a branch in the code. Handle the absent case (`if`, `??`, an early return) or make the type say it cannot be absent.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    return { TSNonNullExpression: (node) => context.report({ node, messageId: "bang" }) }
  },
}

// -- TYPE-SAFETY-4 ---------------------------------------------------------------------------------

/** `any` switches checking off for everything it touches. */
export const noExplicitAny = {
  meta: {
    type: "problem",
    docs: { description: "No `any`; use a real type or `unknown` and narrow." },
    schema: [],
    messages: {
      any:
        "`any` turns type checking off for this value and everything derived from it, silently. Use the real type, a generic, or `unknown` and narrow it where it is used.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    return { TSAnyKeyword: (node) => context.report({ node, messageId: "any" }) }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-double-cast": noDoubleCast,
  "no-type-assertion": noTypeAssertion,
  "no-non-null-assertion": noNonNullAssertion,
  "no-explicit-any": noExplicitAny,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact - it matches one syntactic shape - but a repository adopting it with history should expect
 * each report to be real work: a double cast is usually load-bearing by the time anybody notices,
 * and removing one means giving the value a shape it did not have.
 *
 * `any` and the array spelling are NOT published here. They belong to the TypeScript plugin's own
 * rules, which a consuming repository already has: `@typescript-eslint/no-explicit-any` and
 * `@typescript-eslint/array-type` with the generic default.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
