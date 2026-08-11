/** The rule and flat-config fence that hold `lint-escape-hatch.md`. */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Product source is governed; canon tests deliberately construct forbidden directives. */
const isProductSource = (filename) => normalizePath(filename).includes("/src/")

/** Any directive that changes ESLint's active rule set inside a source file. */
const INLINE_DIRECTIVE = /\beslint-(?:disable(?:-next-line|-line)?|enable)\b/

/** Inline lint configuration is repository policy, never a file-local choice. */
export const noInlineLintConfig = {
  meta: {
    type: "problem",
    docs: { description: "Product source cannot change its own ESLint policy." },
    schema: [],
    messages: {
      directive:
        "Inline ESLint configuration makes this file the author of whether repository law applies. Remove the directive and fix the code or the shared rule; there is no local exception path.",
    },
  },
  create(context) {
    if (!isProductSource(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          if (INLINE_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "directive" })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-inline-lint-config": noInlineLintConfig,
}

/** Every lint escape is a build error. */
export const recommended = {
  "starci-fe/no-inline-lint-config": "error",
}

/** Consuming flat configs apply this beside the recommended rules. */
export const linterOptions = Object.freeze({ noInlineConfig: true })
