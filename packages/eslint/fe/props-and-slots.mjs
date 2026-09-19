/** Rules for named React props, ordinary children, and local visual ownership. */

const isTestFile = (filename) => /(?:^|[\\/])(?:[^\\/]+\.)?(?:spec|test)\.[cm]?[jt]sx?$/.test(String(filename || ""))
const isComponentSource = (filename) => /(?:^|[\\/])src[\\/]components[\\/]/.test(String(filename || "").replace(/\\/g, "/"))
const propertyName = (node) => {
  const key = node?.key ?? node?.property
  if (!key) return null
  if (key.type === "Identifier") return key.name
  if (key.type === "Literal" && typeof key.value === "string") return key.value
  return null
}

/** Reject anonymous object types on named component parameters. */
export const noInlineParameterType = {
  meta: {
    type: "suggestion",
    docs: { description: "A parameter uses a named props type, not an inline object shape." },
    schema: [],
    messages: { inline: "Name this parameter type in the module so the component API can be reused." },
  },
  create(context) {
    const check = (node) => {
      for (const param of node.params || []) {
        const type = param?.typeAnnotation?.typeAnnotation
        if (type?.type === "TSTypeLiteral" || type?.type === "TSIntersectionType" && type.types.some((item) => item.type === "TSTypeLiteral")) {
          context.report({ node: param.typeAnnotation || param, messageId: "inline" })
        }
      }
    }
    return { ArrowFunctionExpression: check, FunctionExpression: check, FunctionDeclaration: check }
  },
}

const isExported = (node) => node.parent?.type === "ExportNamedDeclaration" || node.parent?.parent?.type === "ExportNamedDeclaration"
const containsJsx = (node, seen = new Set()) => {
  if (!node || typeof node !== "object" || seen.has(node)) return false
  seen.add(node)
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true
  return Object.entries(node).some(([key, value]) => key !== "parent" && (Array.isArray(value) ? value.some((item) => containsJsx(item, seen)) : containsJsx(value, seen)))
}
const componentNameOf = (node) => {
  if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier" || !/^[A-Z]/.test(node.id.name) || !isExported(node)) return null
  return node.id.name
}

/** Require exported React components to expose one named props parameter. */
export const publicComponentSignature = {
  meta: {
    type: "problem",
    docs: { description: "Exported React components use one parameter named props with a matching XProps type." },
    schema: [],
    messages: {
      parameter: "Exported component {{name}} must be an arrow const with exactly one parameter named props.",
      type: "Exported component {{name}} must type props as {{expected}}.",
    },
  },
  create(context) {
    const check = (node, name, fn) => {
      if (!name || !fn) return
      const params = fn.params || []
      if (params.length !== 1 || params[0].type !== "Identifier" || params[0].name !== "props") {
        context.report({ node: fn, messageId: "parameter", data: { name } })
        return
      }
      const type = params[0].typeAnnotation?.typeAnnotation
      const expected = [name.endsWith("Base") ? `${name.slice(0, -4)}Props` : `${name}Props`]
      const actual = type?.type === "TSTypeReference" && type.typeName?.type === "Identifier" ? type.typeName.name : null
      if (!actual || !expected.includes(actual)) context.report({ node: params[0], messageId: "type", data: { name, expected: expected.join(" or ") } })
    }
    if (!isComponentSource(context.filename || context.getFilename()) || isTestFile(context.filename || context.getFilename())) return {}
    return {
      VariableDeclarator(node) {
        const name = componentNameOf(node)
        if (name && node.init?.type === "ArrowFunctionExpression" && containsJsx(node.init)) check(node, name, node.init)
      },
      FunctionDeclaration(node) {
        if (!isExported(node) || !containsJsx(node)) return
        context.report({ node, messageId: "parameter", data: { name: node.id?.name || "component" } })
      },
    }
  },
}

/** Prevent callers from styling internal component parts through named CSS props. */
export const noPerPartClassNameProp = {
  meta: {
    type: "problem",
    docs: { description: "Components do not expose per-part class name props." },
    schema: [],
    messages: { perPart: "Keep internal part styling owned by the component." },
  },
  create(context) {
    if (!isComponentSource(context.filename || context.getFilename()) || isTestFile(context.filename || context.getFilename())) return {}
    return { TSPropertySignature(node) { const name = propertyName(node); if (name && name !== "className" && /^[a-z][A-Za-z0-9]*ClassName$/.test(name)) context.report({ node, messageId: "perPart" }) } }
  },
}

/** Keep component appearance local instead of exposing className placement doors. */
export const noPublicClassNameProp = {
  meta: {
    type: "problem",
    docs: { description: "House components do not expose className or classNames props." },
    schema: [],
    messages: { declaration: "Component props must not expose {{prop}}.", usage: "Do not pass {{prop}} to house component {{component}}." },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestFile(filename)) return {}
    const bindings = new Set()
    return {
      ImportDeclaration(node) { if (!/components\//.test(String(node.source?.value || ""))) return; for (const specifier of node.specifiers || []) if (specifier.local?.name) bindings.add(specifier.local.name) },
      TSPropertySignature(node) { if (isComponentSource(filename) && ["className", "classNames"].includes(propertyName(node))) context.report({ node, messageId: "declaration", data: { prop: propertyName(node) } }) },
      JSXOpeningElement(node) { const component = node.name?.type === "JSXIdentifier" ? node.name.name : null; if (!component || !bindings.has(component)) return; for (const attribute of node.attributes || []) { const prop = attribute.name?.type === "JSXIdentifier" ? attribute.name.name : null; if (["className", "classNames"].includes(prop)) context.report({ node: attribute, messageId: "usage", data: { prop, component } }) } },
    }
  },
}

/** Keep layout APIs semantic rather than exposing raw CSS decisions above leaves. */
export const noPublicFrameCssProps = {
  meta: { type: "problem", docs: { description: "Non-leaf component props do not expose CSS-shaped frame decisions." }, schema: [], messages: { css: "Move {{prop}} into component-owned layout behavior." } },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isTestFile(filename) || !isComponentSource(filename) || /[\\/]leaves[\\/]/.test(String(filename).replace(/\\/g, "/"))) return {}
    const cssProps = new Set(["gap", "padding", "align", "justify", "className", "classNames", "style", "inline", "nested"])
    return { TSPropertySignature(node) { const name = propertyName(node); if (cssProps.has(name)) context.report({ node, messageId: "css", data: { prop: name } }) } }
  },
}

/** Prevent utility types from reintroducing public styling doors. */
export const noCssDoorTypeLaundering = {
  meta: { type: "problem", docs: { description: "Omit, Pick, and Exclude cannot hide styling props." }, schema: [], messages: { utility: "Remove {{prop}} from the owning public type instead of hiding it with {{utility}}." } },
  create(context) {
    if (!String(context.filename || context.getFilename()).replace(/\\/g, "/").includes("/src/")) return {}
    return { TSTypeReference(node) { const utility = node.typeName?.type === "Identifier" ? node.typeName.name : null; const params = node.typeArguments?.params || node.typeParameters?.params || []; if (!utility || !["Omit", "Pick", "Exclude"].includes(utility)) return; const keys = params[1]?.type === "TSLiteralType" ? [params[1].literal?.value] : params[1]?.types?.map((item) => item.literal?.value) || []; const prop = keys.find((key) => ["className", "classNames", "style"].includes(key)); if (prop) context.report({ node, messageId: "utility", data: { utility, prop } }) } }
  },
}

export const rules = {
  "no-inline-parameter-type": noInlineParameterType,
  "public-component-signature": publicComponentSignature,
  "no-per-part-classname-prop": noPerPartClassNameProp,
  "no-public-classname-prop": noPublicClassNameProp,
  "no-public-frame-css-props": noPublicFrameCssProps,
  "no-css-door-type-laundering": noCssDoorTypeLaundering,
}

/** All rules in this law are mechanical errors once adopted. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
