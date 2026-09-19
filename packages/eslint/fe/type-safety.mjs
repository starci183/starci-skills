/**
 * The rules that hold `type-safety.md`.
 *
 * ONE RULE HERE, AND TWO ELSEWHERE. `any` is refused by the TypeScript plugin's own rule and the
 * array spelling by its formatter rule, so neither is reimplemented - a second copy of somebody
 * else's rule is a second thing to keep in step, and the one nobody edits is the one that stops
 * matching. What is left is the double cast, which no off-the-shelf rule refuses because most
 * codebases consider it a legitimate escape.
 *
 * THE EXEMPTION IS A PATH, and it has to be. Proving a closed API refuses bad input means building
 * bad input, and there is no way to construct a value the types forbid without telling the compiler
 * to forget them. A judgement-based exemption would be argued at every call site; a path is argued
 * once, here.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Product source lives under `src/`; tooling and config are out of scope. */
const isSourceFile = (filename) => normalizePath(filename).includes("/src/")

/** A test may build a value the types forbid, because that is what it is proving. */
const isTestFile = (filename) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(normalizePath(filename))

/** Product source this rule governs. */
const isGoverned = (filename) => isSourceFile(filename) && !isTestFile(filename)

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
    if (!isGoverned(context.filename || context.getFilename())) return {}
    return {
      TSAsExpression(node) {
        // The outer cast of a `x as unknown as T` pair: its operand is itself a cast to `unknown`.
        const inner = node.expression
        if (!inner || inner.type !== "TSAsExpression") return
        if (!isUnknown(inner.typeAnnotation)) return
        context.report({ node, messageId: "double" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-double-cast": noDoubleCast,
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
