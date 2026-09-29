/**
 * The rules that hold `next-conventions.md` (HFS `FE_NEXT_CONVENTIONS`, with the lead's locale
 * decision: ONE locale pattern everywhere - `next-intl`, a `[locale]` segment, default `vi`,
 * `localePrefix: "as-needed"`, and `proxy.ts` on Next 16).
 *
 * WHY ONE PATTERN. Three repositories held three spellings of the same thing: a `[lang]` segment in
 * the standard's own example, two i18n stacks in one app so that `/` redirected into a 404, and a
 * `middleware.ts` that Next 16 no longer accepts under that name. Each is invisible to a type
 * check and each is found by a reader hitting the wrong page. The rules below hold the spellings a
 * single file can show; whether `routing.ts` carries `localePrefix: "as-needed"` is the
 * architecture machine's read of `modules/i18n`.
 */

import { baseName, isSpecFile, stem } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** Another i18n stack: a second place that decides which language a reader sees. */
const OTHER_I18N = /^(?:react-i18next|i18next|next-i18next|react-intl|next-translate|@lingui\/.+|typesafe-i18n|rosetta)$/

// -- FE-NEXT-1 -------------------------------------------------------------------------------------

/** Next 16 names the request interceptor `proxy.ts`; `middleware.ts` is forbidden. */
export const noMiddlewareFile = {
  meta: {
    type: "problem",
    docs: { description: "`middleware.ts` is forbidden: the request interceptor is `proxy.ts` and exports `proxy`." },
    schema: [],
    messages: {
      file:
        "`{{name}}` is the retired name of the request interceptor. Next 16 calls it `proxy.ts`: rename the file and export the handler as `proxy`.",
      export:
        "The handler in `proxy.ts` is exported as `middleware`, which is the retired name. Export it as `proxy`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const name = baseName(file)
    if (isSpecFile(file)) return {}
    if (stem(file) === "middleware" && /(?:^|\/)src\/middleware\.[cm]?[jt]sx?$/.test(file)) {
      return { Program: (node) => context.report({ node, messageId: "file", data: { name } }) }
    }
    if (stem(file) !== "proxy" || !/(?:^|\/)src\/proxy\.[cm]?[jt]s$/.test(file)) return {}
    const check = (node) => {
      const names = []
      const declaration = node.declaration
      if (declaration && declaration.id) names.push(declaration.id.name)
      if (declaration && declaration.type === "VariableDeclaration") {
        for (const d of declaration.declarations) if (d.id.type === "Identifier") names.push(d.id.name)
      }
      for (const specifier of node.specifiers ?? []) names.push(specifier.exported.name)
      if (names.includes("middleware")) context.report({ node, messageId: "export" })
    }
    return { ExportNamedDeclaration: check, ExportDefaultDeclaration: check }
  },
}

// -- FE-NEXT-2 -------------------------------------------------------------------------------------

/** The locale segment is `[locale]`. */
export const localeSegmentIsLocale = {
  meta: {
    type: "problem",
    docs: { description: "The locale route segment is `[locale]`, never `[lang]`." },
    schema: [],
    messages: {
      segment:
        "This file sits under a `[{{name}}]` segment. The one locale pattern is `[locale]` (next-intl, default `vi`, `localePrefix: \"as-needed\"`); a second spelling means a second routing table.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const match = /\/app\/(?:.*\/)?\[(lang|lng|language|i18n)\]\//.exec(file)
    if (!match) return {}
    return { Program: (node) => context.report({ node, messageId: "segment", data: { name: match[1] } }) }
  },
}

// -- FE-NEXT-3 -------------------------------------------------------------------------------------

/** Exactly one i18n stack: next-intl. */
export const noSecondI18nStack = {
  meta: {
    type: "problem",
    docs: { description: "`next-intl` is the only i18n library." },
    schema: [],
    messages: {
      stack:
        "`{{name}}` is a second i18n stack. Two stacks decide the language twice and disagree at the edges (one app redirected `/` into a 404 that way). Use `next-intl` through `modules/i18n`.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = String(node.source.value)
        if (OTHER_I18N.test(source)) context.report({ node, messageId: "stack", data: { name: source } })
      },
    }
  },
}

// -- FE-NEXT-4 -------------------------------------------------------------------------------------

/** `<html lang>` follows the `[locale]` segment. */
export const htmlLangFromLocale = {
  meta: {
    type: "problem",
    docs: { description: "`<html lang>` is taken from the `[locale]` segment, never a literal." },
    schema: [],
    messages: {
      lang:
        "`<html lang=\"...\">` is a literal. A Vietnamese product that ships `lang=\"en\"` mislabels every page for screen readers, translation prompts and search engines. Set it from the `[locale]` param: `lang={locale}`.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "html") return
        for (const attribute of node.attributes) {
          if (attribute.type !== "JSXAttribute" || attribute.name.name !== "lang" || !attribute.value) continue
          const value = attribute.value
          const literal =
            value.type === "Literal" ||
            (value.type === "JSXExpressionContainer" &&
              (value.expression.type === "Literal" ||
                (value.expression.type === "TemplateLiteral" && value.expression.expressions.length === 0)))
          if (literal) context.report({ node: attribute, messageId: "lang" })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-middleware-file": noMiddlewareFile,
  "locale-segment-is-locale": localeSegmentIsLocale,
  "no-second-i18n-stack": noSecondI18nStack,
  "html-lang-from-locale": htmlLangFromLocale,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
