/**
 * The rule that holds the front-end stack (`knowledge/hfs/fe-stack.yaml`, failure code `FE_STACK_FORBIDDEN`).
 *
 * ONE LIBRARY PER CONCERN. Every common front-end concern - GraphQL, REST, data hooks, toast, forms, state, realtime, i18n, UI,
 * icons, motion, dates, numbers, storage, charts, markdown, code - has one canonical library, the same for the lite and the full
 * edition (owner ruling 2026-10-13). A second library for a concern is a second set of conventions a reader has to know and a
 * second dependency a release has to keep current, and it always arrives one import at a time. The catalog names, per concern,
 * the alternatives a front end never imports; this rule refuses exactly those, read from the catalog, so the list lives once.
 *
 * SUPABASE IS AUTH ONLY. With a Supabase connection the front end holds the Supabase Auth client and nothing else of Supabase
 * (the data path is GraphQL to the back end): `@supabase/*` is imported only by `modules/auth` (slot `fe.modules.auth`).
 *
 * WHAT IS LEFT TO SIBLINGS. A canonical library imported in the wrong place (Apollo outside `modules/api`, axios outside its REST
 * calls, socket.io-client outside `hooks/socketio`) and `fetch` outside the API layer are `fetch-only-in-api-client`'s findings;
 * a glyph library outside the icon leaf is the icon law's. Each import is judged by one rule.
 */
import { forbiddingConcern, packageNameOf } from "./lib/fe-stack.mjs"
import { globalReferences, inSlot, isProductSource } from "./lib/scope.mjs"

/** The package scope only the identity-provider client may import. */
const SUPABASE_SCOPE = "@supabase/"

/**
 * No import (static, re-export, dynamic or `require`) of a package the fe-stack catalog forbids, and no `@supabase/*` outside
 * `modules/auth`. Type-only imports count: a type import still makes the package a dependency of the front end.
 */
export const feStackImport = {
  meta: {
    type: "problem",
    docs: { description: "A front end imports no library the fe-stack catalog forbids, and `@supabase/*` only in `modules/auth`." },
    schema: [],
    messages: {
      forbidden:
        "`{{name}}` is a forbidden alternative for the {{concern}} concern of the front-end stack. The stack has one library per concern, the same in every app and both editions: use {{canonical}} ({{pattern}}). {{why}}",
      supabase:
        "`{{name}}` is imported outside `modules/auth`. Supabase on the front end is the auth client only, held by `modules/auth` (the session, the access token the Apollo link attaches, sign-in and sign-out); data is read and written through the GraphQL operations of `modules/api`, never through Supabase from the browser.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    const authOwner = inSlot(context, "fe.modules.auth")
    const judge = (node, source) => {
      const name = packageNameOf(source)
      if (name === null) return
      const concern = forbiddingConcern(source)
      if (concern) {
        const named = concern.packages?.length > 0 ? concern.packages : concern.home ?? []
        const canonical = named.map((entry) => `\`${entry}\``).join(", ")
        context.report({ node, messageId: "forbidden", data: { name, concern: concern.id, canonical, pattern: concern.pattern ?? "", why: concern.why ?? "" } })
        return
      }
      if (name.startsWith(SUPABASE_SCOPE) && !authOwner) context.report({ node, messageId: "supabase", data: { name } })
    }
    return {
      ImportDeclaration(node) {
        judge(node, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) judge(node, node.source.value)
      },
      ExportAllDeclaration(node) {
        judge(node, node.source.value)
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") judge(node, node.source.value)
      },
      TSImportEqualsDeclaration(node) {
        // `import x = require("moment")`
        if (node.moduleReference?.type === "TSExternalModuleReference" && node.moduleReference.expression?.type === "Literal") judge(node, node.moduleReference.expression.value)
      },
      CallExpression(node) {
        // `require("moment")` where `require` is the CommonJS global.
        if (node.callee.type !== "Identifier" || node.callee.name !== "require" || node.arguments[0]?.type !== "Literal") return
        if (globalReferences(context, new Set(["require"])).includes(node.callee)) judge(node, node.arguments[0].value)
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "fe-stack-import": feStackImport,
}

/** Every rule is an error: a second library for a concern is the defect, not a style. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
