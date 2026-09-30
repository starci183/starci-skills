/**
 * The rules that hold the shape-slot law (example: examples/shape-slot).
 *
 * TWO AXES, AND ONLY ONE IS DRAWN. A surface's `state` is its SHAPE: a layout the owner approves as
 * one drawing. A slot's data status (loading, forbidden, error, empty) is not a shape; it is a
 * recipe applied per api through `SlotView`, and it is never drawn. Mixing the two is what made
 * every block ship four hand-drawn variants that disagreed with each other.
 *
 * THE PURE HALF TAKES ATOMS. `component.tsx` receives `{ state, props, on }`: `props` is data
 * (strings, numbers, booleans, arrays, plain objects), `on` is actions whose arguments are data,
 * and the children it renders are written inside it, never handed in. A layout alone also takes
 * `children`, because the router puts the page there.
 *
 * ONLY ITS OWN INDEX MAY IMPORT IT. Other tiers use the connected export, so the pure half stays a
 * private drawing surface that audit can render from a fixture.
 *
 * Every rule reads one file. Types imported from elsewhere are trusted as data; only names this
 * file declares are followed, which is exact for the tree the convention produces and silent,
 * never wrong, beyond it.
 */

import { hfsOf } from "./lib/hfs.mjs"
import { classifyImport, fileOf, inSlot, isSpecFile, kindOfFile, roleOfFile } from "./lib/scope.mjs"

/** The layers and feature kinds that split into a connected `index.tsx` and a pure `component.tsx`; a shared package's layers never split. */
const SPLIT_KINDS = new Set(["blocks", "pages", "layouts", "overlays"])

/** The folder name of the linted file: the surface a `component.tsx` or `index.tsx` belongs to. */
const surfaceName = (context) => hfsOf(context).relative(fileOf(context)).split("/").slice(-2)[0]

/** Whether the linted file sits in a component or feature owner of a split kind. */
const inSplitTier = (context) => inSlot(context, "fe.components", "fe.feature") && SPLIT_KINDS.has(kindOfFile(context))

/** The pure half of a split tier (the drawing role of a surface folder), and which tier it is. */
const pureHalf = (context) =>
  inSplitTier(context) && roleOfFile(context) === "drawing" && /^[A-Z][A-Za-z0-9]*$/.test(surfaceName(context)) ? kindOfFile(context) : null

/** Type names that carry a rendered tree rather than data. */
const NON_ATOM_TYPE = /^(?:ReactNode|ReactElement|ReactPortal|JSX\.Element|Element|ComponentType|FC|FunctionComponent|ElementType|ComponentProps|RenderFunction)$/

/** The printed name of a type reference, qualified names included. */
const typeNameOf = (node) => {
  const name = node?.typeName
  if (!name) return ""
  if (name.type === "Identifier") return name.name
  if (name.type === "TSQualifiedName") return `${typeNameOf({ typeName: name.left })}.${name.right.name}`
  return ""
}

/** Every type this file declares, by name, so references can be followed locally. */
const collectLocalTypes = (program) => {
  const types = new Map()
  const visit = (statement) => {
    const declaration = statement?.type === "ExportNamedDeclaration" ? statement.declaration : statement
    if (declaration?.type === "TSTypeAliasDeclaration") types.set(declaration.id.name, declaration.typeAnnotation)
    if (declaration?.type === "TSInterfaceDeclaration") types.set(declaration.id.name, declaration.body)
  }
  for (const statement of program.body) visit(statement)
  return types
}

/** The members of an object-shaped type node, following local names and intersections. */
const membersOf = (node, types, seen = new Set()) => {
  if (!node) return []
  if (node.type === "TSTypeLiteral") return node.members
  if (node.type === "TSInterfaceBody") return node.body
  if (node.type === "TSIntersectionType") return node.types.flatMap((part) => membersOf(part, types, seen))
  if (node.type === "TSTypeReference") {
    const name = typeNameOf(node)
    if (seen.has(name) || !types.has(name)) return []
    seen.add(name)
    return membersOf(types.get(name), types, seen)
  }
  return []
}

/** The key a property signature declares. */
const keyOf = (member) => (member.key?.type === "Identifier" ? member.key.name : member.key?.value)

// -- SHAPE-SLOT-1 ----------------------------------------------------------------------------------

/** The pure half takes `{ state, props, on }` of atoms; only a layout also takes `children`. */
export const basePropsAtom = {
  meta: {
    type: "problem",
    docs: { description: "A pure `XBase` takes `state`, atom `props` and `on` actions; no component or tree crosses in." },
    schema: [],
    messages: {
      tree:
        "`{{path}}` hands a rendered tree (`{{type}}`) into the pure half. Write the child inside `component.tsx` and pass it atoms (ids, strings, flags); a tree handed in cannot be drawn, audited or reused.",
      action:
        "`{{path}}` is a function inside `props`. Actions live in `on`, so `props` stays pure data that a fixture can hold.",
      onData:
        "`on.{{key}}` is not an action. `on` holds functions only; data belongs in `props`.",
      member:
        "`{{key}}` is not part of the pure contract. A pure half takes `state`, `props` and `on`{{children}}.",
    },
  },
  create(context) {
    const tier = pureHalf(context)
    if (!tier) return {}
    let types = new Map()

    /** Walk a data type: report trees and functions anywhere inside it. */
    const checkData = (node, path, seen) => {
      if (!node) return
      switch (node.type) {
        case "TSFunctionType":
          context.report({ node, messageId: "action", data: { path } })
          return
        case "TSTypeReference": {
          const name = typeNameOf(node)
          if (NON_ATOM_TYPE.test(name)) {
            context.report({ node, messageId: "tree", data: { path, type: name } })
            return
          }
          for (const argument of node.typeArguments?.params ?? node.typeParameters?.params ?? []) checkData(argument, path, seen)
          if (types.has(name) && !seen.has(name)) {
            seen.add(name)
            checkData(types.get(name), path, seen)
          }
          return
        }
        case "TSUnionType":
        case "TSIntersectionType":
          for (const part of node.types) checkData(part, path, seen)
          return
        case "TSArrayType":
          checkData(node.elementType, path, seen)
          return
        case "TSTypeOperator":
          checkData(node.typeAnnotation, path, seen)
          return
        case "TSTypeLiteral":
        case "TSInterfaceBody":
          for (const member of node.members ?? node.body) {
            if (member.type === "TSMethodSignature") {
              context.report({ node: member, messageId: "action", data: { path: `${path}.${keyOf(member)}` } })
            } else if (member.type === "TSPropertySignature") {
              checkData(member.typeAnnotation?.typeAnnotation, `${path}.${keyOf(member)}`, seen)
            }
          }
          return
        default:
      }
    }

    /** Walk `on`: every member is a function whose parameters are data. */
    const checkActions = (node) => {
      for (const member of membersOf(node, types)) {
        const key = keyOf(member)
        const type = member.type === "TSMethodSignature" ? member : member.typeAnnotation?.typeAnnotation
        if (type?.type !== "TSFunctionType" && type?.type !== "TSMethodSignature") {
          context.report({ node: member, messageId: "onData", data: { key } })
          continue
        }
        for (const parameter of type.params ?? type.parameters ?? []) {
          checkData(parameter.typeAnnotation?.typeAnnotation, `on.${key}(${parameter.name ?? "arg"})`, new Set())
        }
      }
    }

    return {
      Program(node) {
        types = collectLocalTypes(node)
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier" || !/^[A-Z][A-Za-z0-9]*Base$/.test(node.id.name)) return
        const fn = node.init
        if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") return
        const annotation = fn.params?.[0]?.typeAnnotation?.typeAnnotation
        for (const member of membersOf(annotation, types)) {
          const key = keyOf(member)
          const type = member.typeAnnotation?.typeAnnotation
          if (key === "state") continue
          if (key === "props") checkData(type, "props", new Set())
          else if (key === "on") checkActions(type)
          else if (key === "children" && tier === "layouts") continue
          else {
            context.report({
              node: member,
              messageId: "member",
              data: { key, children: tier === "layouts" ? ", plus the router's `children`" : "" },
            })
          }
        }
      },
    }
  },
}

// -- SHAPE-SLOT-2 ----------------------------------------------------------------------------------

/** Only the sibling `index.tsx` (and its specs) may reach `component.tsx`; only `X` leaves the folder. */
export const baseImportPair = {
  meta: {
    type: "problem",
    docs: { description: "A pure `component.tsx` is imported only by its sibling `index.tsx`, which never re-exports `XBase`." },
    schema: [],
    messages: {
      reach:
        "`{{source}}` reaches into another surface's pure half. Import that surface's connected export from its folder; the pure half is a private drawing surface.",
      reexport:
        "`index.tsx` re-exports `{{name}}`. The folder exports only its connected `X`; the pure `XBase` stays behind it so no other tier can bypass the owner.",
    },
  },
  create(context) {
    const isOwnIndex = roleOfFile(context) === "entry"
    const spec = isSpecFile(fileOf(context))
    const inTier = inSplitTier(context)
    // An import reaches a pure half when the file it resolves to has the `drawing` role of its slot.
    const reachesPure = (source) => classifyImport(context, source)?.role === "drawing"

    const check = (node, source) => {
      if (typeof source !== "string" || !reachesPure(source)) return
      const isSibling = /^\.\/[^/]+$/.test(source)
      if (isSibling && (isOwnIndex || spec)) return
      if (isSibling && !inTier) return
      context.report({ node, messageId: "reach", data: { source } })
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source?.value)
      },
      ExportAllDeclaration(node) {
        check(node, node.source?.value)
      },
      ExportNamedDeclaration(node) {
        const source = node.source?.value
        if (!source) return
        check(node, source)
        if (!isOwnIndex || !inTier || node.exportKind === "type") return
        for (const specifier of node.specifiers ?? []) {
          const name = specifier.exported?.name ?? specifier.local?.name
          if (specifier.exportKind !== "type" && /^[A-Z][A-Za-z0-9]*Base$/.test(name)) {
            context.report({ node: specifier, messageId: "reexport", data: { name } })
          }
        }
      },
    }
  },
}

// -- SHAPE-SLOT-3 ----------------------------------------------------------------------------------

/** Words that name a data status or an open/closed lifecycle, never a drawn shape. */
const DATA_STATUS = new Set([
  "pending", "loading", "failed", "error", "errored", "empty", "forbidden", "unavailable",
  "skeleton", "closed", "idle", "refreshing", "retrying",
])

/** A surface's `XState` names shapes only. */
export const noDataStatusShape = {
  meta: {
    type: "problem",
    docs: { description: "`XState` of a pure half names drawn shapes, never a data status or open/closed." },
    schema: [],
    messages: {
      status:
        "`{{name}}` lists \"{{value}}\" as a shape. Loading, forbidden, error and empty are a slot's data status: pass them as `Slot<T>` in `props` and render them through `SlotView`. Open/closed is an atom (`isOpen`). A shape is a layout the owner approves as one drawing.",
    },
  },
  create(context) {
    if (!pureHalf(context)) return {}
    const check = (name, node) => {
      const members = node?.type === "TSUnionType" ? node.types : [node]
      for (const member of members) {
        const value = member?.type === "TSLiteralType" ? member.literal?.value : undefined
        if (typeof value === "string" && DATA_STATUS.has(value)) {
          context.report({ node: member, messageId: "status", data: { name, value } })
        }
      }
    }
    return {
      TSTypeAliasDeclaration(node) {
        if (/^[A-Z][A-Za-z0-9]*State$/.test(node.id.name)) check(node.id.name, node.typeAnnotation)
      },
    }
  },
}

// -- SHAPE-SLOT-4 ----------------------------------------------------------------------------------

/** Flags that are a slot's data status. */
const STATUS_FLAG = /^(?:isLoading|isError|isForbidden|isPending|isValidating|isEmpty)$/

/** The name a test expression reads, if it is a status flag. */
const statusFlagOf = (node) => {
  if (!node) return null
  if (node.type === "UnaryExpression") return statusFlagOf(node.argument)
  if (node.type === "ChainExpression") return statusFlagOf(node.expression)
  if (node.type === "Identifier" && STATUS_FLAG.test(node.name)) return node.name
  if (node.type === "MemberExpression" && node.property?.type === "Identifier" && STATUS_FLAG.test(node.property.name)) {
    return node.property.name
  }
  if (node.type === "LogicalExpression" || node.type === "BinaryExpression") return statusFlagOf(node.left) ?? statusFlagOf(node.right)
  return null
}

/** A block's pure half never branches on a data status itself. */
export const slotStatusThroughSlotView = {
  meta: {
    type: "problem",
    docs: { description: "A block's pure half renders data status through `SlotView`, never its own branch." },
    schema: [],
    messages: {
      branch:
        "This branches on `{{flag}}` by hand. Every slot renders its status through `SlotView`, the one recipe: a second branch drifts from it and becomes one more variant somebody draws.",
    },
  },
  create(context) {
    if (pureHalf(context) !== "blocks") return {}
    const check = (node, test) => {
      const flag = statusFlagOf(test)
      if (flag) context.report({ node, messageId: "branch", data: { flag } })
    }
    return {
      ConditionalExpression(node) {
        check(node, node.test)
      },
      IfStatement(node) {
        check(node, node.test)
      },
      LogicalExpression(node) {
        if (node.operator === "&&" && node.parent?.type === "JSXExpressionContainer") check(node, node.left)
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "base-props-atom": basePropsAtom,
  "base-import-pair": baseImportPair,
  "no-data-status-shape": noDataStatusShape,
  "slot-status-through-slotview": slotStatusThroughSlotView,
}

/** Every FE canon rule is an error; existing debt is fixed before adoption. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
