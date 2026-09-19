/**
 * The classNames law: component markup consumes named styling declarations, while colocated
 * classNames files own the utility-token composition.
 */

const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")
const isComponentSource = (filename) => normalizePath(filename).includes("/src/components/")
const isClassNamesFile = (filename) => /\/classNames\.tsx?$/.test(normalizePath(filename))
const isClassAttribute = (node) => node.type === "JSXAttribute" && ["className", "class"].includes(node.name?.name)
const isCn = (node) => node?.type === "Identifier" && node.name === "cn"

const importedClassNames = (context) => {
  const imports = new Set()
  const sourceCode = context.sourceCode || context.getSourceCode()
  for (const statement of sourceCode.ast.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "./classNames") continue
    for (const specifier of statement.specifiers) imports.add(specifier.local.name)
  }
  return imports
}

const isExportedOwner = (node) => {
  let current = node
  while (current) {
    if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(current.type)) {
      current = current.parent
      if (current?.type === "VariableDeclarator") current = current.parent
      if (current?.type === "VariableDeclaration") current = current.parent
      return ["ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(current?.type)
    }
    if (current.type === "VariableDeclarator") {
      current = current.parent?.parent
      return ["ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(current?.type)
    }
    current = current.parent
  }
  return false
}

const visitTokenLeaves = (node, report) => {
  if (!node) return
  if (node.type === "ArrayExpression") {
    report(node, "array")
    return
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    if (/\s/.test(node.value) || /\d+,\d+/.test(node.value)) report(node, "token")
    return
  }
  if (node.type === "ConditionalExpression" || node.type === "LogicalExpression") {
    visitTokenLeaves(node.consequent ?? node.left, report)
    visitTokenLeaves(node.alternate ?? node.right, report)
  }
}

const isEmptyClassName = (node) => node?.type === "Literal" && node.value === null || node?.type === "Identifier" && node.name === "undefined"

const usesImportedClassName = (node, imported) => {
  if (!node) return false
  if (node.type === "Identifier") return imported.has(node.name) || node.name === "undefined"
  if (isEmptyClassName(node)) return true
  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier") return imported.has(node.callee.name)
    return node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" && imported.has(node.callee.object.name)
  }
  if (node.type === "MemberExpression") return node.object.type === "Identifier" && imported.has(node.object.name)
  if (node.type === "ConditionalExpression") return usesImportedClassName(node.consequent, imported) && usesImportedClassName(node.alternate, imported)
  if (node.type === "LogicalExpression") {
    if (node.operator === "&&") return usesImportedClassName(node.right, imported)
    return usesImportedClassName(node.left, imported) && usesImportedClassName(node.right, imported)
  }
  return false
}

/** Report className values written directly in component JSX. */
export const noInlineClassName = {
  meta: {
    type: "problem",
    docs: { description: "Component JSX must import a named className declaration." },
    schema: [],
    messages: { inline: "Move this className value to an imported colocated classNames.ts export." },
  },
  create(context) {
    if (!isComponentSource(context.filename || context.getFilename())) return {}
    const imported = importedClassNames(context)
    return {
      JSXAttribute(node) {
        if (!isClassAttribute(node) || !node.value) return
        const expression = node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value
        if (!usesImportedClassName(expression, imported)) context.report({ node, messageId: "inline" })
      },
    }
  },
}

/** Require every classNames declaration to use the colocated classNames.ts convention. */
export const classNamesInColocatedFile = {
  meta: {
    type: "problem",
    docs: { description: "Reusable className declarations belong in colocated classNames.ts files." },
    schema: [],
    messages: { misplaced: "Put reusable className declarations in a colocated classNames.ts file." },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (!isComponentSource(filename)) return {}
    return {
      CallExpression(node) {
        if (!isCn(node.callee) || isClassNamesFile(filename)) return
        context.report({ node, messageId: "misplaced" })
      },
    }
  },
}

/** Require variadic cn utility tokens: no arrays, whitespace-packed values, or fractional commas. */
export const cnArgumentsAreSingleTokens = {
  meta: {
    type: "problem",
    docs: { description: "Each cn argument is one valid utility token." },
    schema: [],
    messages: {
      array: "Pass utility tokens to cn as variadic arguments, not an array.",
      token: "Each cn argument must be one utility token without whitespace or malformed fractional commas.",
      unexported: "Export every className declaration or function that produces a cn value.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (!isClassNamesFile(filename)) return {}
    return {
      CallExpression(node) {
        if (!isCn(node.callee)) return
        if (!isExportedOwner(node)) context.report({ node, messageId: "unexported" })
        for (const argument of node.arguments) visitTokenLeaves(argument, (reportedNode, messageId) => context.report({ node: reportedNode, messageId }))
      },
    }
  },
}

/** Every rule this law publishes. */
export const rules = {
  "no-inline-class-name": noInlineClassName,
  "class-names-in-colocated-file": classNamesInColocatedFile,
  "cn-arguments-are-single-tokens": cnArgumentsAreSingleTokens,
}

/** Recommended severity for the classNames law. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
