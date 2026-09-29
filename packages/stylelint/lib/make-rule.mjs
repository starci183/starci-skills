/**
 * One constructor for every rule of the canon, so each is an error by construction: a rule takes `true` (and
 * an optional `{ appTokens }` secondary), never `null`, `false` or a severity downgrade, and reports through one
 * path. Severity is not configurable here; the factory config sets `defaultSeverity: "error"`.
 */
import stylelint from "stylelint"

const { createPlugin, utils } = stylelint

const isString = (value) => typeof value === "string"

/**
 * @param {string} name short rule name, published as `starci/<name>`
 * @param {Record<string, (...args: any[]) => string>} messages message builders by key
 * @param {(ctx: { root: import("postcss").Root, report: Function, options: { appTokens: string[] } }) => void} run
 */
export function makeRule(name, messages, run) {
  const ruleName = `starci/${name}`
  const built = utils.ruleMessages(ruleName, messages)

  const rule = (primary, secondary) => (root, result) => {
    const valid = utils.validateOptions(
      result,
      ruleName,
      { actual: primary, possible: [true] },
      { actual: secondary, possible: { appTokens: [isString] }, optional: true },
    )
    if (!valid) return
    const report = (node, key, args = [], extra = {}) =>
      utils.report({ ruleName, result, node, message: built[key](...args), ...extra })
    run({ root, report, options: { appTokens: secondary?.appTokens ?? [] } })
  }
  rule.ruleName = ruleName
  rule.messages = built
  rule.meta = { fixable: false }

  return { name, ruleName, rule, plugin: createPlugin(ruleName, rule) }
}
