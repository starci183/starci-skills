/**
 * The rules that hold the public surface of an owner (catalog R30 `BE_PUBLIC_SURFACE`, BE-CONVENTION 1.15 and 2.4).
 *
 * Every owner (a feature, a domain or platform capability, an integration) has exactly ONE `index.ts` at its root and
 * that file is its public surface. Four rules read import specifiers and the shape of index files against the HFS slot
 * view; none of them reads a path pattern, and an alias is resolved through the program's own `compilerOptions.paths`:
 *
 *   - `import-owner-entry` - a cross-owner import targets the owner's `index.ts` (`@modules/domain/plan`,
 *     `@features/plan`), never a file inside it, and an alias that names a tier but no owner (`@modules/domain`) names
 *     nothing importable. A same-owner import is relative and never goes through the owner's own `index.ts`.
 *   - `no-self-module-alias` - inside an owner, imports are relative, never the owner's own alias.
 *   - `no-relative-capability-escape` - a relative import never walks out of its own owner.
 *   - `no-folder-reexport` - a specifier that names a directory is refused; a nested `index.ts` (any index that is not
 *     at its owner's root) is refused; an owner's `index.ts` holds only named `export { }` / `export type { }` lines
 *     re-exporting from files, never `export *`, never a declaration, and at most `budget.indexExports` names.
 *
 * "Which owner does this file belong to" is `hfs.ownerOf`; "which owner does this specifier reach" is the same question
 * asked of the file the specifier resolves to. Nothing here touches disk.
 */
import { posix } from "node:path"
import { hfsOf } from "./lib/hfs.mjs"
import { baseName } from "./lib/ports.mjs"
import { typed } from "./lib/types.mjs"

/** The tiers whose files belong to an owner with a root `index.ts`. */
const OWNER_TIERS = new Set(["feature", "domain", "platform", "integrations"])

/**
 * The owner directory (repository-relative) a file belongs to, or null.
 *
 * A slot whose "root" is the file itself (a stray file directly in a tier folder) owns nothing.
 *
 * @param {object} hfs - The HFS view.
 * @param {string} file - An absolute or repository-relative file path.
 * @returns {string | null} The owner's root directory.
 */
const ownerDirOf = (hfs, file) => {
  const root = hfs.ownerOf(file)
  return root && root !== hfs.relative(file) ? root : null
}

/** The forward-slash absolute path of a repository-relative path. */
const absolute = (hfs, rel) => `${hfs.repoRoot.replace(/\\/g, "/")}/${rel}`

/** The owner an import path (no extension, absolute) reaches: the owner of `<path>/index.ts`, which any file or folder of that owner shares. */
const ownerOfTarget = (hfs, target) => ownerDirOf(hfs, `${target}/index.ts`)

/**
 * The absolute path an alias specifier maps to under the program's `compilerOptions.paths`, or null when no pattern matches.
 *
 * @param {object} context - The ESLint rule context.
 * @param {string} specifier - An import specifier.
 * @returns {{ target: string, rest: string } | null} The absolute target without extension and the part the wildcard matched.
 */
const resolveAlias = (context, specifier) => {
  const options = typed(context).program.getCompilerOptions()
  const base = options.baseUrl ?? options.pathsBasePath
  if (!options.paths || typeof base !== "string") return null
  for (const [pattern, targets] of Object.entries(options.paths)) {
    if (!pattern.endsWith("/*") || !targets[0]) continue
    const prefix = pattern.slice(0, -1)
    if (!specifier.startsWith(prefix)) continue
    const rest = specifier.slice(prefix.length)
    return { target: posix.normalize(`${base.replace(/\\/g, "/")}/${targets[0].replace("*", rest)}`), rest }
  }
  return null
}

/** A specifier that names a directory by construction: `.`, `./`, `..`, `../`, or a trailing `/`. */
const isBareFolderSpecifier = (specifier) =>
  specifier === "." || specifier === "./" || specifier === ".." || specifier === "../" || specifier.endsWith("/")

const isRelative = (specifier) => specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../")

/** The absolute path a relative specifier names from a file, without touching disk. */
const resolveRelative = (filename, specifier) => posix.normalize(`${posix.dirname(filename.replace(/\\/g, "/"))}/${specifier}`)

/** Calls `check(node, specifier)` for every import and re-export that names a module. */
const onSpecifiers = (check) => ({
  ImportDeclaration(node) {
    check(node.source, node.source.value)
  },
  ExportNamedDeclaration(node) {
    if (node.source) check(node.source, node.source.value)
  },
  ExportAllDeclaration(node) {
    if (node.source) check(node.source, node.source.value)
  },
})

/** The public-surface width: the `budget.indexExports` of the slot that owns the file, else of the first back-end owner slot that states one. */
const indexExportBudget = (hfs, filename) =>
  [hfs.slotOf(filename), "be.domain", "be.feature"].map((id) => (id ? hfs.slot(id)?.budget?.indexExports : undefined)).find(Number.isInteger)

// -- R30: import-owner-entry -----------------------------------------------------------------------

/**
 * A cross-owner import targets the owner's public entry: the alias and the owner, nothing deeper. A same-owner import
 * is relative and never goes through the owner's own `index.ts` (BE-CONVENTION 2.4).
 */
export const importOwnerEntry = {
  meta: {
    type: "problem",
    docs: { description: "Import another owner through its public entry (`index.ts`); import inside an owner relatively and never through its own `index.ts`." },
    schema: [],
    messages: {
      barrel:
        "`{{specifier}}` names a tier, not an owner. Import an owner's public entry, for example `@modules/domain/plan` or `@features/plan`.",
      deep:
        "`{{specifier}}` reaches into a file of another owner. Import the owner's public entry (its `index.ts`) and export what you need from there.",
      ownIndex:
        "`{{specifier}}` goes through this owner's own `index.ts`. The index is the surface other owners see; inside the owner import the file that declares the symbol, relatively.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const hfs = hfsOf(context)
    const self = ownerDirOf(hfs, filename)
    return onSpecifiers((node, specifier) => {
      if (typeof specifier !== "string") return
      if (isRelative(specifier)) {
        if (isBareFolderSpecifier(specifier) || !self) return
        const target = resolveRelative(filename, specifier)
        if (posix.basename(target) === "index" && posix.dirname(target) === absolute(hfs, self)) {
          context.report({ node, messageId: "ownIndex", data: { specifier } })
        }
        return
      }
      const alias = resolveAlias(context, specifier)
      if (!alias) return
      const owner = ownerOfTarget(hfs, alias.target)
      if (!owner) {
        // an alias that reaches a tier folder but no owner in it: nothing importable is named
        if (OWNER_TIERS.has(hfs.tierOf(`${alias.target}/index.ts`) ?? "") || OWNER_TIERS.has(hfs.tierOf(`${alias.target}.ts`) ?? "")) {
          context.report({ node, messageId: "barrel", data: { specifier } })
        }
        return
      }
      // reaching one's own owner through its alias is no-self-module-alias's finding
      if (owner === self) return
      const ownerAbsolute = absolute(hfs, owner)
      const inside = alias.target === ownerAbsolute ? "" : alias.target.slice(ownerAbsolute.length + 1)
      if (inside !== "" && inside !== "index") context.report({ node, messageId: "deep", data: { specifier } })
    })
  },
}

// -- no-self-module-alias --------------------------------------------------------------------------

/** Inside an owner, imports are relative -- never the owner's own public alias. */
export const noSelfModuleAlias = {
  meta: {
    type: "problem",
    docs: { description: "Inside an owner, import relatively rather than through its own alias." },
    schema: [],
    messages: {
      self:
        "`{{specifier}}` reaches this owner through its own public alias. That is the owner talking to itself through its front door: a cycle magnet, and a lie about the boundary - the alias exists to say \"this comes from elsewhere\". Use a relative import.",
    },
  },
  create(context) {
    const hfs = hfsOf(context)
    const self = ownerDirOf(hfs, context.filename || context.getFilename())
    if (!self) return {}
    return onSpecifiers((node, specifier) => {
      if (typeof specifier !== "string" || isRelative(specifier)) return
      const alias = resolveAlias(context, specifier)
      if (alias && ownerOfTarget(hfs, alias.target) === self) context.report({ node, messageId: "self", data: { specifier } })
    })
  },
}

// -- no-folder-reexport ----------------------------------------------------------------------------

/** Whether a file is an index by its role name. */
const isIndexFile = (filename) => /^index\.[cm]?[jt]sx?$/.test(baseName(filename))

/**
 * No file re-exports a folder, and an owner's index lists a bounded set of named exports.
 *
 * The public entry of an owner is a short, explicit list, one per owner root:
 *  - a bare-dot or trailing-slash specifier names a directory by construction, in any file;
 *  - an `index` file that is not at its owner's root is a nested barrel;
 *  - in an `index` file: `export *` hides the surface instead of listing it, anything but a named `export { } from` /
 *    `export type { } from` line (an import, a declaration, a default export, a local export) is refused, and more
 *    than the manifest's `indexExports` names is not a public surface but the inside of the owner.
 *
 * What this accepts: `export { PlanModule } from "./plan.module"` and `export type { PlanSummary } from "./plan.contracts"`.
 */
export const noFolderReexport = {
  meta: {
    type: "problem",
    docs: { description: "No file re-exports a folder, no `index.ts` is nested, and an owner's `index.ts` lists a bounded set of named exports." },
    schema: [],
    messages: {
      bareSpecifier:
        "`{{specifier}}` names a directory, not a file. An owner's public surface is the files call sites actually import - re-exporting a whole folder makes that surface a list nobody reads instead. Export the specific file.",
      indexBarrel:
        "`{{name}}` is a public entry and must list explicit named exports. Replace export-star with the symbols this owner exposes.",
      nestedIndex:
        "This `index.ts` is not at its owner's root ({{owner}}). An owner has exactly one `index.ts`, the public surface; a nested barrel is a second surface. Delete it and import the files directly, relatively.",
      onlyNamedExports:
        "An owner's `index.ts` holds only named `export { } from \"./file\"` and `export type { } from \"./file\"` lines. Move this out of the index into the file that owns it and re-export the name.",
      tooWide:
        "This public entry exports {{count}} names, above the budget of {{max}}. An entry that wide is the inside of the owner: split the owner, or export fewer, narrower contracts.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const hfs = hfsOf(context)
    const isIndex = isIndexFile(filename)
    const max = indexExportBudget(hfs, filename)
    let count = 0
    return {
      ...onSpecifiers((node, specifier) => {
        if (typeof specifier === "string" && isBareFolderSpecifier(specifier)) context.report({ node, messageId: "bareSpecifier", data: { specifier } })
      }),
      Program(node) {
        if (!isIndex) return
        const owner = ownerDirOf(hfs, filename)
        if (owner && posix.dirname(hfs.relative(filename)) !== owner) context.report({ node, messageId: "nestedIndex", data: { owner } })
        for (const statement of node.body) {
          const named = statement.type === "ExportNamedDeclaration" && statement.source && !statement.declaration
          if (statement.type === "ExportAllDeclaration") {
            count += 1
            context.report({ node: statement, messageId: "indexBarrel", data: { name: baseName(filename) } })
          } else if (!named) {
            context.report({ node: statement, messageId: "onlyNamedExports" })
          } else {
            count += statement.specifiers.length
          }
        }
      },
      "Program:exit"(node) {
        if (isIndex && Number.isInteger(max) && count > max) context.report({ node, messageId: "tooWide", data: { count, max } })
      },
    }
  },
}

// -- no-relative-capability-escape -----------------------------------------------------------------

/**
 * A relative specifier may never leave the owner it is written in. The public-entry rule already says an import from
 * another owner goes through its `index.ts`; a relative path can just as easily walk OUT (`../../other-owner/thing`),
 * reaching a sibling owner without ever naming it. A file doing that could not be moved with its owner and still
 * resolve, because the path assumes the sibling is sitting right there on disk.
 */
export const noRelativeCapabilityEscape = {
  meta: {
    type: "problem",
    docs: { description: "A relative import may not walk out of its own owner." },
    schema: [],
    messages: {
      escape:
        "`{{specifier}}` is a relative import that leaves the `{{from}}` owner and reaches `{{to}}`. Cross an owner boundary through the other owner's public entry (its alias), never by walking out with `../`.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const hfs = hfsOf(context)
    const self = ownerDirOf(hfs, filename)
    if (!self) return {}
    return onSpecifiers((node, specifier) => {
      if (typeof specifier !== "string" || !isRelative(specifier)) return
      const target = ownerOfTarget(hfs, resolveRelative(filename, specifier))
      if (target && target !== self) context.report({ node, messageId: "escape", data: { specifier, from: self, to: target } })
    })
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "import-owner-entry": importOwnerEntry,
  "no-self-module-alias": noSelfModuleAlias,
  "no-folder-reexport": noFolderReexport,
  "no-relative-capability-escape": noRelativeCapabilityEscape,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All four are `error`. HFS keeps no baseline: a repository adopts them after its migration lane has moved its imports
 * onto owner entries, and `starciBeConfig` states them at `error` with none switched off.
 */
export const recommended = {
  "starci-be/import-owner-entry": "error",
  "starci-be/no-self-module-alias": "error",
  "starci-be/no-folder-reexport": "error",
  "starci-be/no-relative-capability-escape": "error",
}
