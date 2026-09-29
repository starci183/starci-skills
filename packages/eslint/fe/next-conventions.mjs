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

import { attribute, attributeValue, calleeName, leadingTextOf, stringOf } from "./lib/ast.mjs"
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

// -- FE-NEXT-5 -------------------------------------------------------------------------------------

/** True for a route page: a `page.tsx` anywhere under `app`. */
const isPageFile = (file) => /\/app\/(?:.*\/)?page\.[cm]?tsx?$/.test(file)

/** The names a module exports, from declarations and specifiers. */
const exportedNames = (program) => {
  const names = new Set()
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue
    const declaration = statement.declaration
    if (declaration && declaration.id) names.add(declaration.id.name)
    if (declaration && declaration.type === "VariableDeclaration") {
      for (const entry of declaration.declarations) if (entry.id.type === "Identifier") names.add(entry.id.name)
    }
    for (const specifier of statement.specifiers ?? []) names.add(specifier.exported.name)
  }
  return names
}

/** Every page names itself: `metadata` or `generateMetadata`. */
export const pageExportsMetadata = {
  meta: {
    type: "problem",
    docs: { description: "Every `page.tsx` exports `metadata` or `generateMetadata`." },
    schema: [],
    messages: {
      metadata:
        "This page exports neither `metadata` nor `generateMetadata`, so it ships with whatever title its layout happens to have: every page of the section is called the same in the tab, in the history, in a shared link and in a search result. Export `metadata` (or `generateMetadata` when the title comes from data), with the title and description taken from the message catalogue.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(file) || !isPageFile(file)) return {}
    return {
      "Program:exit"(program) {
        const names = exportedNames(program)
        if (!names.has("metadata") && !names.has("generateMetadata")) context.report({ node: program, messageId: "metadata" })
      },
    }
  },
}

// -- FE-NEXT-6 -------------------------------------------------------------------------------------

/** A Suspense boundary shows something while it waits. */
export const noNullSuspenseFallback = {
  meta: {
    type: "problem",
    docs: { description: "`<Suspense>` has a fallback that renders something; `fallback={null}` is forbidden." },
    schema: [],
    messages: {
      nullFallback:
        "`<Suspense>` with a `null` (or missing) fallback: while the subtree loads the reader sees a hole where content will jump in, with no sign anything is happening. Render the loading state of the thing that is loading (the block's skeleton).",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXOpeningElement(node) {
        const name = node.name
        const isSuspense =
          (name.type === "JSXIdentifier" && name.name === "Suspense") ||
          (name.type === "JSXMemberExpression" && name.property.name === "Suspense")
        if (!isSuspense) return
        const fallback = attribute(node, "fallback")
        const value = attributeValue(fallback)
        const empty =
          !fallback ||
          !value ||
          (value.type === "Literal" && value.value === null) ||
          (value.type === "Identifier" && value.name === "undefined")
        if (empty) context.report({ node, messageId: "nullFallback" })
      },
    }
  },
}

// -- FE-NEXT-7 -------------------------------------------------------------------------------------

/** Files that legitimately sit outside the locale provider or own the navigation module. */
const isNavigationOwner = (file) =>
  /\/modules\/i18n\//.test(file) || /\/app\/global-error\.[cm]?tsx?$/.test(file) || /\/src\/proxy\.[cm]?[jt]s$/.test(file)

/** The router helpers that are locale-blind in `next/navigation`. */
const LOCALE_BLIND = new Set(["useRouter", "usePathname", "redirect", "permanentRedirect"])

/** Navigation helpers come from `modules/i18n/navigation`, which knows the locale. */
export const navigationFromIntl = {
  meta: {
    type: "problem",
    docs: { description: "`Link`, `useRouter`, `usePathname` and `redirect` come from `modules/i18n/navigation`, not from Next." },
    schema: [],
    messages: {
      link:
        "`next/link` does not know the locale: a link built with it drops the `[locale]` prefix, so a Vietnamese reader lands on the default language of the next page (or on a 404 under `localePrefix: \"as-needed\"`). Import `Link` from `modules/i18n/navigation`, which `next-intl` builds from `routing.ts`.",
      helper:
        "`{{name}}` from `next/navigation` does not know the locale: it navigates to a path without the `[locale]` prefix. Import it from `modules/i18n/navigation`, which `next-intl` builds from `routing.ts`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(file) || isNavigationOwner(file)) return {}
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return
        const source = String(node.source.value)
        if (source === "next/link") return context.report({ node, messageId: "link" })
        if (source !== "next/navigation") return
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.importKind !== "type" && LOCALE_BLIND.has(specifier.imported.name)) {
            context.report({ node: specifier, messageId: "helper", data: { name: specifier.imported.name } })
          }
        }
      },
    }
  },
}

// -- FE-NEXT-8 -------------------------------------------------------------------------------------

/** An href that leaves the app: a scheme, a protocol-relative URL, or an in-page anchor. */
const isExternalHref = (text) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(text)

/** No hand-drawn `<a>` for an internal route; an external one opens safely. */
export const noNativeAnchor = {
  meta: {
    type: "problem",
    docs: { description: "An internal link is `Link` from `modules/i18n/navigation`; an external `_blank` link carries `rel`." },
    schema: [],
    messages: {
      internal:
        "`<a href=\"{{href}}\">` for a route of this app: it reloads the whole page, skips prefetch and drops the locale prefix. Use `Link` from `modules/i18n/navigation` with an href built by `modules/routes`.",
      rel:
        "`target=\"_blank\"` with no `rel`. The opened page can reach back through `window.opener`. Add `rel=\"noopener noreferrer\"`.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "a") return
        const href = stringOf(attributeValue(attribute(node, "href")))
        if (href !== null && href !== "" && !isExternalHref(href)) context.report({ node, messageId: "internal", data: { href } })
        const target = stringOf(attributeValue(attribute(node, "target")))
        const rel = attribute(node, "rel")
        if (target === "_blank" && !rel) context.report({ node, messageId: "rel" })
      },
    }
  },
}

// -- FE-NEXT-9 -------------------------------------------------------------------------------------

/** The functions whose first argument is a route: the router's methods and the two redirects. */
const isNavigation = (name) =>
  name === "redirect" || name === "permanentRedirect" || /(?:^|\.)router\.(?:push|replace|prefetch)$/.test(name)

/** True for `/x`, `/x/y`; false for `//host` and for `/` alone, which every app owns. */
const isInternalPath = (text) => text.startsWith("/") && !text.startsWith("//") && text.length > 1

/** The one place that may write a route: `modules/routes`. */
const isRoutesModule = (file) => /\/modules\/routes\//.test(file) || /\/modules\/i18n\//.test(file)

/** No route written by hand outside `modules/routes`. */
export const noHardcodedRoute = {
  meta: {
    type: "problem",
    docs: { description: "A route path is built by `modules/routes`, never written as a literal at a link or a navigation call." },
    schema: [],
    messages: {
      route:
        "`{{path}}` is a route written by hand. When the route moves, every copy of it silently points at a 404, and nothing type-checks the difference. Build it with the href builder in `modules/routes` and use that one function everywhere.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (isSpecFile(file) || isRoutesModule(file)) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    const report = (node, text) => context.report({ node, messageId: "route", data: { path: text } })
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "href") return
        const value = attributeValue(node)
        const lead = leadingTextOf(value)
        if (lead !== null && isInternalPath(lead)) report(node, source.getText(value))
      },
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (!name || !isNavigation(name)) return
        const first = node.arguments[0]
        const lead = leadingTextOf(first)
        if (lead !== null && isInternalPath(lead)) report(first, source.getText(first))
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
  "page-exports-metadata": pageExportsMetadata,
  "no-null-suspense-fallback": noNullSuspenseFallback,
  "navigation-from-intl": navigationFromIntl,
  "no-native-anchor": noNativeAnchor,
  "no-hardcoded-route": noHardcodedRoute,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
