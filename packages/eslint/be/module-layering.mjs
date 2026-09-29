/**
 * The rules that hold `module-layering.mjs`'s law file, `module-layering.md`.
 *
 * Four rules, all reading import specifiers, export specifiers, decorators or a filename against
 * the path of the file being linted. They are cheap and exact -- none of them touches disk -- which
 * is the whole reason they can be `error`:
 *   - `must-deep-module-import` / `no-self-module-alias` hold LAYERING-1 and LAYERING-2. Under HFS the
 *     first is the cross-owner public-entry rule: an aliased import names the owner and stops there
 *     (`@modules/domain/plan`, `@features/plan`), so it lands on the owner's `index.ts`. A path into a
 *     file of another owner, or an alias root or tier with no owner, is refused.
 *   - `no-folder-reexport` holds LAYERING-5 / Law 7 and the width of an HFS `index.ts`: no folder
 *     re-export, no `export *`, no `*_STORE` token, no whole `types/` folder, and at most the manifest's
 *     `indexExports` names.
 *   - `@Global()` is not decided here: `global-module-allowlist` (module-shape.mjs) reads the allowlist.
 *   - `no-relative-capability-escape` holds Law 8 (a relative import may not walk out of its own
 *     capability -- crossing a boundary always goes through the declared public alias).
 *
 * LAYERING-3 (a capability module importing a sibling capability) is NOT here, and the omission is
 * deliberate rather than an oversight: deciding whether an imported module is a sibling capability
 * or a nested child needs the module graph, and a rule reading one file at a time cannot see it. In
 * the reference repository that rule exists and is scoped by path glob; a repository adopting this
 * law should port it as a gate that walks the tree, not as a per-file rule that guesses. The same
 * reasoning is why `no-self-global-module` stops at the `@Global()` decorator and does not also
 * chase a hardcoded `isGlobal: true` passed into a `.register(...)` call -- this repository passes
 * that option through at every level of legitimate nesting, and only the module graph can tell a
 * nested child from a foreign capability.
 *
 * Module tiers (`domain/`, `platform/`, `integrations/`) contain capabilities. Their name is the
 * second segment; an alias ending there names its explicit index.ts public entry. The first segment
 * alone names a tier, not a capability.
 */

import { normalizePath } from "./lib/path.mjs"
import { hfsParams } from "./lib/slots.mjs"

/**
 * Category folders that hold capabilities rather than being one.
 *
 * Under these the capability name is the second segment. They are the three HFS tiers; `lib` is not one.
 */
const META_ROOTS = new Set(["domain", "platform", "integrations"])

/** The aliases a capability is reachable through. */
const ALIASES = [
  {
    prefix: "@modules/",
    root: "/src/modules/",
    metaAware: true,
    publicEntry: true,
  },
  {
    prefix: "@features/",
    root: "/src/features/",
    metaAware: false,
    publicEntry: true,
  },
  {
    prefix: "@tests/",
    root: "/src/tests/",
    metaAware: false,
    publicEntry: false,
  },
]

// -- LAYERING-1 ------------------------------------------------------------------------------------

/**
 * An aliased import lands on an owner's public entry: the alias and the owner, nothing deeper.
 *
 * HFS gives every owner (a feature, a domain or platform capability, an integration) one `index.ts` that
 * lists what it offers. An import from another owner therefore names the owner and stops
 * (`@modules/domain/plan`, `@features/plan`); `@modules/domain/plan/plan.service` reaches past that entry
 * into a file the owner did not offer, and `@modules/domain` or `@modules` names no owner at all. The
 * rule's published name is older than the standard - it once required the opposite, a path INTO a file -
 * and is kept because the name is what a build log and a manifest cite; the behavior is HFS's.
 *
 * Reaching into one's own owner through its alias is `no-self-module-alias`'s finding, not this one's.
 */
export const mustDeepModuleImport = {
  meta: {
    type: "problem",
    docs: { description: "Import another owner through its public entry: the alias and the owner, never a path into it." },
    schema: [],
    messages: {
      barrel:
        "`{{specifier}}` stops before an owner. Import an owner's public entry, for example `@modules/domain/plan` or `@features/plan`.",
      deep:
        "`{{specifier}}` reaches into a file of another owner. Import the owner's public entry (its `index.ts`) and export what you need from there.",
    },
  },
  create(context) {
    const self = selfAliases(context.filename || context.getFilename())
    const check = (node, specifier) => {
      if (typeof specifier !== "string") return
      const alias = ALIASES.find((candidate) => specifier.startsWith(candidate.prefix))
      if (!alias) return

      const rest = specifier.slice(alias.prefix.length)
      if (!rest) {
        context.report({ node, messageId: "barrel", data: { specifier } })
        return
      }
      const parts = rest.split("/")
      const ownerDepth = alias.metaAware && META_ROOTS.has(parts[0]) ? 2 : 1
      if (parts.length < ownerDepth || (!alias.publicEntry && parts.length === ownerDepth)) {
        context.report({ node, messageId: "barrel", data: { specifier } })
        return
      }
      if (!alias.publicEntry || parts.length === ownerDepth) return
      const entryFile = parts.length === ownerDepth + 1 && parts[ownerDepth] === "index"
      if (entryFile) return
      // reaching into one's own owner through its alias is no-self-module-alias's finding
      if (self && self.prefix === alias.prefix && self.keys.some((key) => rest === key || rest.startsWith(`${key}/`))) return
      context.report({ node, messageId: "deep", data: { specifier } })
    }
    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
    }
  },
}

// -- LAYERING-2 ------------------------------------------------------------------------------------

/** The aliases a file's OWN capability is reachable through, or null when it is in none. */
const selfAliases = (filename) => {
  const file = normalizePath(filename)
  for (const alias of ALIASES) {
    const at = file.lastIndexOf(alias.root)
    if (at === -1) continue
    const parts = file.slice(at + alias.root.length).split("/")
    if (!parts[0]) continue
    if (alias.metaAware && META_ROOTS.has(parts[0]) && parts.length >= 2) {
      // reachable long (`domain/task`) and short (`task`), so both are self
      return {
        prefix: alias.prefix,
        keys: [`${parts[0]}/${parts[1]}`, parts[1]],
      }
    }
    return {
      prefix: alias.prefix,
      keys: [parts[0]],
    }
  }
  return null
}

/** Inside a capability, imports are relative -- never the capability's own public alias. */
export const noSelfModuleAlias = {
  meta: {
    type: "problem",
    docs: { description: "Inside a capability, import relatively rather than through its own alias." },
    schema: [],
    messages: {
      self:
        "`{{specifier}}` reaches this capability through its own public alias. That is the capability talking to itself through its front door: a cycle magnet, and a lie about the boundary - the alias exists to say \"this comes from elsewhere\", so using it for something that does not is exactly the signal that stops meaning anything. Use a relative import.",
    },
  },
  create(context) {
    const self = selfAliases(context.filename || context.getFilename())
    if (!self) return {}

    const check = (node, specifier) => {
      if (typeof specifier !== "string" || !specifier.startsWith(self.prefix)) return
      const rest = specifier.slice(self.prefix.length)
      const hit = self.keys.some((key) => rest === key || rest.startsWith(`${key}/`))
      if (hit) context.report({ node, messageId: "self", data: { specifier } })
    }
    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
    }
  },
}

// -- shared path arithmetic --------------------------------------------------------------------
//
// No fs anywhere below: every check in this file, old and new, reads a specifier string against a
// filename string. Resolving a relative specifier therefore has to be done the same way -- pure
// segment arithmetic against the importer's own path, never a disk lookup.

/** POSIX-style dirname of an already-normalized (forward-slash) path. */
const dirnameOf = (file) => {
  const at = file.lastIndexOf("/")
  return at === -1 ? "" : file.slice(0, at)
}

/**
 * Resolves a relative specifier against the file that imports it, without touching disk.
 *
 * `..` pops a segment, `.` is a no-op, everything else pushes. Whether the importer's directory
 * was rooted (a leading `/`) is preserved, so a POSIX-style absolute path stays POSIX-style after
 * resolution; a Windows drive-letter path (`D:/repo/...`) already carries its root as its first
 * segment and needs nothing extra.
 */
const resolveRelativeSpecifier = (filename, specifier) => {
  const dir = dirnameOf(normalizePath(filename))
  const rooted = dir.startsWith("/")
  const stack = dir.split("/").filter(Boolean)
  for (const part of specifier.split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") {
      stack.pop()
      continue
    }
    stack.push(part)
  }
  return (rooted ? "/" : "") + stack.join("/")
}

// -- LAYERING-5 / Law 7 -------------------------------------------------------------------------

/** This repository's own convention, and the law's Anchor: an `index.*` file at any depth. */
const INDEX_FILE_RE = /(^|\/)index\.(ts|tsx|js|jsx|mjs|cjs)$/

/** A specifier so bare it can only ever name a directory: `.`, `./`, `..`, `../`, or trailing `/`. */
const isBareFolderSpecifier = (specifier) =>
  specifier === "." || specifier === "./" || specifier === ".." || specifier === "../" || specifier.endsWith("/")

/**
 * LAYERING-5 / module-layering.md Law 7, and the shape of an HFS `index.ts` public surface.
 *
 * The public entry of an owner is a short, explicit list. Certain signs, none needing a disk lookup:
 *  - a bare-dot or trailing-slash specifier names a directory by construction, in any file;
 *  - in an `index.*` file: `export *` hides the surface instead of listing it; a specifier ending in
 *    `/types` or `/types/index` exports a whole types folder; an exported name ending in `_STORE` hands out
 *    a storage token; and more than `maxExports` (the `indexExports` budget of the slot manifest) names is not
 *    a public surface but the inside of the owner.
 *
 * What this accepts, because HFS wants it: `export { PlanModule } from "./plan.module"`,
 * `export type { PlanSummary } from "./plan.contracts"`, and `export { entities, migrations } from
 * "./persistence"` - explicit names from named files. Whether a specifier such as `./persistence` is a
 * file or a folder needs the file system, which no rule in this canon touches.
 */
export const noFolderReexport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "LAYERING-5 / HFS: no file re-exports a folder, and an index file lists a bounded set of named exports.",
    },
    schema: [
      {
        type: "object",
        properties: { maxExports: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    messages: {
      bareSpecifier:
        "`{{specifier}}` names a directory, not a file. LAYERING-5: a capability's public surface is the files call sites actually import - re-exporting a whole folder makes that surface a list nobody reads instead. Export the specific file.",
      indexBarrel:
        "`{{name}}` is a public entry and must list explicit named exports. Replace export-star with the symbols this capability exposes.",
      typesFolder:
        "`{{specifier}}` exports a whole types folder from a public entry. List the contract types other owners need, by name.",
      storeToken:
        "`{{name}}` is a storage token. A public entry offers behavior and contracts, not the token that opens the owner's store.",
      tooWide:
        "This public entry exports {{count}} names, above the budget of {{max}}. An entry that wide is the inside of the owner: split the owner, or export fewer, narrower contracts.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    const isIndex = INDEX_FILE_RE.test(filename)
    const max = context.options[0]?.maxExports ?? hfsParams.indexExports
    let count = 0

    const checkSpecifier = (node, specifier) => {
      if (typeof specifier !== "string") return
      if (isBareFolderSpecifier(specifier)) {
        context.report({ node, messageId: "bareSpecifier", data: { specifier } })
      } else if (isIndex && /(?:^|\/)types(?:\/index)?$/.test(specifier)) {
        context.report({ node, messageId: "typesFolder", data: { specifier } })
      }
    }

    return {
      ImportDeclaration(node) {
        checkSpecifier(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSpecifier(node.source, node.source.value)
        if (!isIndex) return
        const declared = []
        if (node.declaration) {
          if (node.declaration.id) declared.push(node.declaration.id)
          for (const declarator of node.declaration.declarations ?? []) if (declarator.id.type === "Identifier") declared.push(declarator.id)
        }
        for (const specifier of node.specifiers) declared.push(specifier.exported)
        count += declared.length
        for (const identifier of declared) {
          const name = identifier.name ?? identifier.value
          if (typeof name === "string" && /_STORE$/.test(name)) context.report({ node: identifier, messageId: "storeToken", data: { name } })
        }
      },
      ExportAllDeclaration(node) {
        if (node.source) checkSpecifier(node.source, node.source.value)
        if (isIndex) count += 1
        if (isIndex && !isBareFolderSpecifier(node.source?.value)) {
          context.report({
            node,
            messageId: "indexBarrel",
            data: { name: filename.slice(filename.lastIndexOf("/") + 1) },
          })
        }
      },
      "Program:exit"(node) {
        if (isIndex && count > max) context.report({ node, messageId: "tooWide", data: { count, max } })
      },
    }
  },
}

// -- Law 8 ("moved to another repository") -------------------------------------------------------

/**
 * Law 8 / the law's own moved-capability test, read as a rule: a relative specifier may never leave
 * the capability it is written in. `LAYERING-2` already says the path must be relative INSIDE a
 * capability; this is the fact `LAYERING-2` does not check -- that a relative path can just as
 * easily walk OUT (`../../other-capability/thing`), reaching a sibling capability without ever
 * naming it through the declared public alias `LAYERING-1` requires. A file doing that could not be
 * moved to another repository with its capability and still resolve: the relative path assumes the
 * sibling is sitting right there on disk.
 *
 * Certain because it never touches disk either -- both sides of the comparison (the importer's own
 * path, and the specifier resolved against it) run through the exact same `selfAliases` lookup this
 * file already uses for `LAYERING-2`, so "different capability" is read off two path strings, not
 * guessed from specifier text.
 */
export const noRelativeCapabilityEscape = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Law 8 (module-layering.md): a capability moved to another repository still resolves every import it declares -- a relative specifier may not walk out of its own capability.",
    },
    schema: [],
    messages: {
      escape:
        "`{{specifier}}` is a relative import that leaves the `{{from}}` capability and reaches `{{to}}`. Law 8: this capability could not be moved to another repository and still resolve that path -- cross a capability boundary through its declared public alias (LAYERING-1), never by walking out with `../`.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    const self = selfAliases(filename)
    if (!self) return {}

    const check = (node, specifier) => {
      if (typeof specifier !== "string") return
      if (!specifier.startsWith("./") && !specifier.startsWith("../")) return
      const resolved = resolveRelativeSpecifier(filename, specifier)
      const target = selfAliases(resolved)
      if (!target) return
      if (target.prefix === self.prefix && target.keys[0] === self.keys[0]) return
      context.report({
        node,
        messageId: "escape",
        data: { specifier, from: self.keys[0], to: target.keys[0] },
      })
    }
    return {
      ImportDeclaration(node) {
        check(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node.source, node.source.value)
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "must-deep-module-import": mustDeepModuleImport,
  "no-self-module-alias": noSelfModuleAlias,
  "no-folder-reexport": noFolderReexport,
  "no-relative-capability-escape": noRelativeCapabilityEscape,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All four are `error`. HFS keeps no baseline: a repository adopts them after its migration lane has
 * moved its imports onto owner entries, and `starciBeConfig` states them at `error` with none switched off.
 */
export const recommended = {
  "starci-be/must-deep-module-import": "error",
  "starci-be/no-self-module-alias": "error",
  "starci-be/no-folder-reexport": "error",
  "starci-be/no-relative-capability-escape": "error",
}
