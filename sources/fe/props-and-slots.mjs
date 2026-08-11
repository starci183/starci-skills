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

/** True when a parameter type contains an anonymous object shape, including inside intersections. */
const isInlineObjectType = (node) => {
  if (!node) return false
  if (node.type === "TSTypeLiteral") return true
  if (node.type === "TSParenthesizedType") return isInlineObjectType(node.typeAnnotation)
  if (node.type === "TSIntersectionType" || node.type === "TSUnionType") {
    return (node.types || []).some(isInlineObjectType)
  }
  return false
}

// -- SLOTS-3 ---------------------------------------------------------------------------------------

/** A parameter's complete shape is named in the module, never assembled at the parameter. */
export const noInlineParameterType = {
  meta: {
    type: "suggestion",
    docs: { description: "A parameter takes one named props type, not an inline or intersected object shape." },
    schema: [],
    messages: {
      inline:
        "This parameter's shape is written inline, so it has no name and nothing can refer to it - not an import, not the twin that tests this file, not somebody looking for what this component accepts. Declare it in the module and name it here. The cost is one line; the difference is between a contract and a signature.",
    },
  },
  create(context) {
    const checkParams = (node) => {
      for (const param of node.params || []) {
        if (!param) continue
        const declared = param.typeAnnotation?.typeAnnotation
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

// -- SLOTS-4 ---------------------------------------------------------------------------------------

/** The only two files where a React `children` hole is lawful. */
const CHILDREN_SHELL = /\/src\/components\/shells\/(?:ModalShell|DrawerShell)\//

/** True for a component file the slot fence governs. Pages and non-source files are outside it. */
const isGoverned = (filename) => {
  const path = String(filename || "").replace(/\\/g, "/")
  return path.includes("/src/components/") && !CHILDREN_SHELL.test(path)
}

/**
 * A container takes `contract` and `render`, never `children`.
 *
 * THE TYPE CANNOT CATCH THIS ONE, which is why it is here. `props.ts` refuses a fourth slot on the
 * aliases it defines, but nothing stops a file declaring its own props shape by hand and putting
 * `children` in it. What the alias makes unrepresentable, a hand-written interface makes ordinary.
 *
 * ModalShell and DrawerShell are exempt because their purpose is to ignore the interior shape and
 * pass it directly to the vendor body. No folder-wide exemption exists.
 */
export const noChildrenSlot = {
  meta: {
    type: "problem",
    docs: { description: "A container takes contract and render; only ModalShell/DrawerShell may take children." },
    schema: [],
    messages: {
      slot:
        "`children` accepts markup that has already been built, so its shape cannot be checked. Take contract + render instead. Only ModalShell and DrawerShell may pass an uninterpreted interior straight to a vendor body.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    return {
      TSPropertySignature(node) {
        if (node.key && node.key.type === "Identifier" && node.key.name === "children") {
          context.report({ node: node.key, messageId: "slot" })
        }
      },
      Property(node) {
        // a destructured `children` in a parameter, which is the same slot arriving by another door
        if (node.parent && node.parent.type !== "ObjectPattern") return
        if (node.parent.parent && node.parent.parent.type === "VariableDeclarator") return
        if (node.key && node.key.type === "Identifier" && node.key.name === "children") {
          context.report({ node: node.key, messageId: "slot" })
        }
      },
    }
  },
}

// -- SLOTS-7 ---------------------------------------------------------------------------------------

/** A joined-list surface receives domain collections through named props, never a generic items lane. */
export const noSurfaceListItemsSlot = {
  meta: {
    type: "problem",
    docs: { description: "SurfaceListCard receives collection data through named props, never items." },
    schema: [],
    messages: {
      items:
        "`items` creates a second runtime-data lane beside `props` and makes SurfaceListCard know every domain collection. Put the collection in the render component's named props type (for example `tasks`) and pass it through `props`.",
    },
  },
  create(context) {
    const filename = String(context.filename || context.getFilename()).replace(/\\/g, "/")
    if (!filename.includes("/src/")) return {}
    const bindings = new Set()
    return {
      ImportDeclaration(node) {
        const source = String(node.source?.value || "").replace(/\\/g, "/")
        if (!/(?:^|\/)components\/branches\/SurfaceListCard$/.test(source)) return
        for (const specifier of node.specifiers || []) {
          const imported = specifier.imported?.name
          if (imported === "SurfaceListCard" && specifier.local?.name) bindings.add(specifier.local.name)
        }
      },
      JSXOpeningElement(node) {
        const component = node.name?.type === "JSXIdentifier" ? node.name.name : null
        if (!component || !bindings.has(component)) return
        for (const attribute of node.attributes || []) {
          if (attribute.type !== "JSXAttribute") continue
          if (attribute.name?.type === "JSXIdentifier" && attribute.name.name === "items") {
            context.report({ node: attribute, messageId: "items" })
          }
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-inline-parameter-type": noInlineParameterType,
  "no-children-slot": noChildrenSlot,
  "no-surface-list-items-slot": noSurfaceListItemsSlot,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact and mechanical: it fires on a syntactic shape rather than on a judgement, so there is no
 * false-positive risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
