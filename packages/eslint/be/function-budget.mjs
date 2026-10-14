/**
 * R291 HFS_FUNCTION_BUDGET: every function body stays within the common line budget.
 *
 * Count the physical span of the body, including braces, comments, blank lines and nested functions.
 * Signatures and parameters are outside the body. An expression arrow has an expression body and
 * counts the expression and its wrapping parentheses, including comments and blanks inside them.
 */
import { hfsOf } from "./lib/hfs.mjs"

/** Functions, methods, constructors, accessors and callbacks all receive the same body budget. */
export const functionLineBudget = {
    meta: {
        type: "problem",
        docs: { description: "A function body stays within ruleParams.functionLines, counting comments and blank lines." },
        schema: [],
        messages: {
            lines: "HFS_FUNCTION_BUDGET: this function body has {{lines}} lines; the budget is {{max}}. Split the work into functions with one responsibility each.",
        },
    },
    create(context) {
        // C08 adds this common parameter to the shipped manifest; keep the owner-decided cap while it lands.
        const max = hfsOf(context).ruleParams.functionLines ?? 80
        if (!Number.isInteger(max) || max < 1) throw new RangeError("ruleParams.functionLines must be a positive integer")
        const source = context.sourceCode || context.getSourceCode()
        const check = (node) => {
            if (!node.body) return
            let start = node.body.loc.start.line
            let end = node.body.loc.end.line
            if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
                const arrow = source.getTokenBefore(node.body, { filter: (token) => token.value === "=>" })
                start = source.getTokenAfter(arrow, { includeComments: true }).loc.start.line
                end = node.loc.end.line
            }
            const lines = end - start + 1
            if (lines > max) context.report({ node: node.body, messageId: "lines", data: { lines, max } })
        }
        return {
            FunctionDeclaration: check,
            FunctionExpression: check,
            ArrowFunctionExpression: check,
        }
    },
}

/** The rule this law contributes to the plugin. */
export const rules = { "function-line-budget": functionLineBudget }

/** The function budget is an error in both editions. */
export const recommended = { "starci-be/function-line-budget": "error" }
