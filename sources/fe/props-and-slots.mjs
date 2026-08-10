/**
 * The rules that hold `props-and-slots.md`.
 *
 * ALMOST ALL OF THIS LAW IS HELD BY A TYPE, not by a rule. The slot aliases in `props.ts` are the
 * fence: a fifth slot does not fail review, it fails to compile, and there is nothing left for a
 * rule to patrol once the shape itself refuses. That is the stronger arrangement and it is why this
 * module is small.
 *
 * What a type cannot see is a shape with no NAME. An inline object type at the parameter satisfies
 * every constraint the alias imposes and is still wrong, because the wrongness is not about which
 * fields exist - it is that nothing else can refer to them. A compiler has no opinion about whether
 * a shape is findable.
 */

/** True when a type node is an inline object literal type, through any parentheses around it. */
const isInlineObjectType = (node) => {
  if (!node) return false
  if (node.type === "TSTypeLiteral") return true
  if (node.type === "TSParenthesizedType") return isInlineObjectType(node.typeAnnotation)
  return false
}

// -- SLOTS-3 ---------------------------------------------------------------------------------------

/** A destructured parameter's shape is named in the module, never written at the parameter. */
export const noInlineParameterType = {
  meta: {
    type: "suggestion",
    docs: { description: "A destructured parameter takes a named type, not an inline object type." },
    schema: [],
    messages: {
      inline:
        "This parameter's shape is written inline, so it has no name and nothing can refer to it - not an import, not the twin that tests this file, not somebody looking for what this component accepts. Declare it in the module and name it here. The cost is one line; the difference is between a contract and a signature.",
    },
  },
  create(context) {
    const checkParams = (node) => {
      for (const param of node.params || []) {
        if (!param || param.type !== "ObjectPattern") continue
        const declared = param.typeAnnotation && param.typeAnnotation.typeAnnotation
        if (!isInlineObjectType(declared)) continue
        context.report({ node: param.typeAnnotation || param, messageId: "inline" })
      }
    }
    return {
      ArrowFunctionExpression: checkParams,
      FunctionExpression: checkParams,
      FunctionDeclaration: checkParams,
      TSEmptyBodyFunctionExpression: checkParams,
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-inline-parameter-type": noInlineParameterType,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact and mechanical: it fires on a syntactic shape rather than on a judgement, so there is no
 * false-positive risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
