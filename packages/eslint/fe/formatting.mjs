/**
 * The rule that holds `formatting.md` (HFS R59 `FE_I18N_PLACEMENT`, sub-check `FE_I18N_FORMATTER`).
 *
 * THE LOCALE HAS ONE OWNER. `next-intl` knows the reader's locale and time zone and hands them to
 * `useFormatter()` / `getFormatter()`. Every other way of turning a number or a date into text either
 * guesses the locale (`toLocaleString()` with no argument uses the SERVER's on the server and the
 * browser's on the client, which is the hydration mismatch that makes a price flicker), hard-codes
 * one (`"en-US"` in a Vietnamese product), or builds a private formatter that ignores the app's
 * currency and date styles. Money and dates are the two places a wrong format is a wrong fact.
 *
 * WHAT IS REFUSED. `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString`; `new Intl.*Format`;
 * `toFixed` when the result is shown (inside JSX or a template); a currency symbol glued to a
 * substitution in a template; and the date libraries (`moment`, `dayjs`, `date-fns`, `luxon`).
 * `modules/i18n/**` is exempt: it is where the formatters are configured.
 */

import { fileOf, inSlot } from "./lib/scope.mjs"

/** The locale-sensitive `Date` and `Number` methods. */
const LOCALE_METHODS = new Set(["toLocaleString", "toLocaleDateString", "toLocaleTimeString"])

/** The `Intl` formatters a product must not build itself. */
const INTL_FORMATTERS = new Set(["NumberFormat", "DateTimeFormat", "RelativeTimeFormat", "ListFormat", "PluralRules"])

/** Date libraries that format on their own locale. */
const DATE_LIBRARIES = /^(?:moment(?:-timezone)?|dayjs|date-fns(?:\/.+)?|luxon)$/

/** A currency mark or code beside a substitution. */
const CURRENCY = /[₫€£¥]|\b(?:VND|USD|EUR)\b/

/** True when `node` is displayed: it sits in a JSX expression or a template literal. */
const isDisplayed = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "JSXExpressionContainer" || current.type === "TemplateLiteral") return true
    if (current.type === "ArrowFunctionExpression" || current.type === "FunctionExpression" || current.type === "FunctionDeclaration") return false
  }
  return false
}

/** Numbers, money and dates are formatted by the `next-intl` formatter. */
export const useIntlFormatter = {
  meta: {
    type: "problem",
    docs: { description: "Format numbers, money and dates with `useFormatter` / `getFormatter` from `next-intl`." },
    schema: [],
    messages: {
      method:
        "`{{name}}` formats with a locale this file does not own: with no argument it is the server's on the server and the browser's in the browser (a price that flickers on hydration), with a string it is one language for every reader. Use `useFormatter().number(...)` / `.dateTime(...)` (or `getFormatter()` on the server).",
      intl:
        "`new Intl.{{name}}` builds a private formatter that ignores the app's locale, time zone and named formats. Use the `next-intl` formatter, and put a shared format in `modules/i18n` once.",
      fixed:
        "`.toFixed()` in displayed text writes a number with a dot decimal separator and no grouping to every reader. Use `useFormatter().number(value, { maximumFractionDigits })`.",
      currency:
        "A currency mark glued to a substitution in a template writes the symbol on the wrong side for half of the locales and skips grouping. Use `useFormatter().number(value, { style: \"currency\", currency })`.",
      library:
        "`{{name}}` formats dates on its own locale data, next to `next-intl`'s. One library decides the language of a date: use the `next-intl` formatter (`dateTime`, `relativeTime`).",
    },
  },
  create(context) {
    if (inSlot(context, "fe.modules.i18n")) return {}
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value)
        if (DATE_LIBRARIES.test(source)) context.report({ node, messageId: "library", data: { name: source } })
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
        const name = callee.property.name
        if (LOCALE_METHODS.has(name)) context.report({ node, messageId: "method", data: { name } })
        else if (name === "toFixed" && isDisplayed(node)) context.report({ node, messageId: "fixed" })
      },
      NewExpression(node) {
        const callee = node.callee
        if (
          callee.type === "MemberExpression" &&
          callee.object.type === "Identifier" &&
          callee.object.name === "Intl" &&
          callee.property.type === "Identifier" &&
          INTL_FORMATTERS.has(callee.property.name)
        ) {
          context.report({ node, messageId: "intl", data: { name: callee.property.name } })
        }
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0) return
        const glued = node.quasis.some((quasi, index) => {
          const text = quasi.value.cooked ?? ""
          if (index < node.expressions.length && text.endsWith("$")) return true
          return CURRENCY.test(text)
        })
        if (glued) context.report({ node, messageId: "currency" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "use-intl-formatter": useIntlFormatter,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
