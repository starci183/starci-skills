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

import { COMPONENT_ROOTS, isContractTableFile, isInComponentTier } from "./contract.mjs"

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

/** The only three components where a React `children` hole is lawful. */
const CHILDREN_SHELLS = ["ModalShell", "DrawerShell", "DropdownShell", "RouteShell"]

/**
 * True for a component file the slot fence governs.
 *
 * TWO EXEMPTIONS AND ONE LAYOUT FIX, all of which this predicate got wrong at once.
 *
 * It read `/src/components/` as a literal, so in a monorepo - where the same tier sits at
 * `packages/ui/src/*` - the rule applied to NOTHING. That repository reported no violations, which
 * looked like compliance and was silence: the fence was not holding anywhere in it.
 *
 * The registry table is exempt because `ContractSpec.children` is not a children hole; it is the
 * NAMED CHILD GRAMMAR that replaces one. Reporting it asks the file that abolished the anonymous
 * slot to stop describing what it admits instead.
 *
 * The three shells stay exempt for the reason canon already gives them: they pass real children
 * through and arrange nothing.
 *
 * @param filename - the file being linted.
 */
const isGoverned = (filename) => {
  const path = String(filename || "").replace(/\\/g, "/")
  if (isContractTableFile(path)) return false
  if (CHILDREN_SHELLS.some((shell) => isInComponentTier(path, `shells/${shell}`))) return false
  /*
   * The bare `src` root is dropped here, and only here. `COMPONENT_ROOTS` carries it as a
   * catch-all so a reader that walks up from any file still finds the table; used as a FENCE it
   * matches every file under `src/`, which pulls routed pages into a rule about component slots and
   * reports a page for taking children - the one thing a page legitimately does.
   */
  return COMPONENT_ROOTS.filter((root) => root !== "src").some((root) => path.includes(`/${root}/`))
}

/**
 * A container takes `contract` and `render`, never `children`.
 *
 * THE TYPE CANNOT CATCH THIS ONE, which is why it is here. `props.ts` refuses a fourth slot on the
 * aliases it defines, but nothing stops a file declaring its own props shape by hand and putting
 * `children` in it. What the alias makes unrepresentable, a hand-written interface makes ordinary.
 *
 * ModalShell, DrawerShell and DropdownShell are exempt because they ignore the interior shape and
 * pass it directly to the vendor body. No folder-wide exemption exists.
 */
export const noChildrenSlot = {
  meta: {
    type: "problem",
    docs: { description: "A container takes contract and render; only the three closed shells may take children." },
    schema: [],
    messages: {
      slot:
        "`children` accepts markup that has already been built, so its shape cannot be checked. Take contract + render instead. Only ModalShell, DrawerShell, DropdownShell and RouteShell may take one - the first three pass an interior straight to vendor mechanics, and RouteShell converts the children a framework layout is handed.",
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
