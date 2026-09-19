/**
 * The rules that hold `module-layering.mjs`'s law file, `module-layering.md`.
 *
 * Five rules, all reading import specifiers, export specifiers, decorators or a filename against
 * the path of the file being linted. They are cheap and exact -- none of them touches disk -- which
 * is the whole reason they can be `error`:
 *   - `must-deep-module-import` / `no-self-module-alias` hold LAYERING-1 and LAYERING-2.
 *   - `no-folder-reexport` holds LAYERING-5 / Law 7 (no file re-exports a folder).
 *   - `no-self-global-module` holds the decidable slice of LAYERING-4 / Law 6 (a capability may not
 *     declare itself `@Global()`; see that rule's own doc comment for what is deliberately still
 *     left undecided).
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
 * THE META-ROOT IS THE TRAP IN MOST OF THESE. Some capabilities sit behind a category folder
 * (`platform/`, `lib/`, `integrations/`), so the capability name is the SECOND segment there and
 * the first everywhere else. Get that wrong and `@modules/platform/exceptions` reads as a
 * capability-with-file rather than as a barrel.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/**
 * Category folders that hold capabilities rather than being one.
 *
 * Under these the capability name is the second segment: `@modules/platform/exceptions` names a
 * capability and no file, so it is a barrel -- while `@modules/ai` names a capability directly.
 */
const META_ROOTS = new Set(["platform", "lib", "integrations"])

/** The aliases a capability is reachable through. */
const ALIASES = [
  {
    prefix: "@modules/",
    root: "/src/modules/",
    metaAware: true,
  },
  {
    prefix: "@features/",
    root: "/src/features/",
    metaAware: false,
  },
  {
    prefix: "@tests/",
    root: "/src/tests/",
    metaAware: false,
  },
]

// -- LAYERING-1 ------------------------------------------------------------------------------------

/** An import names the declaring file, never a folder that re-exports one. */
export const mustDeepModuleImport = {
  meta: {
    type: "problem",
    docs: { description: "Import the declaring file, never a capability barrel." },
    schema: [],
    messages: {
      barrel:
        "`{{specifier}}` names a capability and no file. A barrel pulls the whole folder's import graph in to get one symbol - which is how a unit spec ends up booting a database driver, and how two capabilities that never reference each other end up in a cycle through a third. Name the file that declares the symbol.",
    },
  },
  create(context) {
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
      const barrelDepth = alias.metaAware && META_ROOTS.has(parts[0])
        ? 2
        : 1
      if (parts.length <= barrelDepth) {
        context.report({ node, messageId: "barrel", data: { specifier } })
      }
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
      // reachable long (`platform/exceptions`) and short (`exceptions`), so both are self
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
 * LAYERING-5 / module-layering.md Law 7: no file re-exports a folder.
 *
 * Two certain signs, neither needing a disk lookup:
 *  - a bare-dot or trailing-slash specifier names a directory by construction -- no file path ever
 *    looks like that, aliased or relative, so there is nothing to guess;
 *  - a file literally named `index.*` whose entire top-level body is re-export statements is the
 *    exact shape the law's own Anchor measures ("Zero index.ts files in the entire source tree").
 *
 * What this deliberately does NOT flag: a single bridging re-export naming a real file
 * (`export { AiInvokeService } from '@modules/ai/ai-invoke.service'`), which LAYERING-1's own
 * common-business-situations list keeps legitimate, and a relative barrel that names a real
 * multi-segment path with no file extension (`export * from './services'`) -- telling that apart
 * from a real file with an implicit extension needs the filesystem, which no rule in this canon
 * touches; see the module doc comment for why that gap is left to LAYERING-1's alias-only reach
 * plus this filename check rather than guessed at.
 */
export const noFolderReexport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "LAYERING-5 / module-layering.md Law 7: no file re-exports a folder -- a bare-directory specifier or an index barrel turns a capability's surface into a list nobody reads.",
    },
    schema: [],
    messages: {
      bareSpecifier:
        "`{{specifier}}` names a directory, not a file. LAYERING-5: a capability's public surface is the files call sites actually import -- re-exporting a whole folder makes that surface a list nobody reads instead. Export the specific file.",
      indexBarrel:
        "This file is named `{{name}}` and its entire content is re-export statements -- the exact shape of an index barrel. LAYERING-5: this repository keeps zero `index.*` files so a barrel specifier never has anything to resolve to. Delete it and have callers import the real files directly.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())

    const checkSpecifier = (node, specifier) => {
      if (typeof specifier !== "string") return
      if (isBareFolderSpecifier(specifier)) {
        context.report({ node, messageId: "bareSpecifier", data: { specifier } })
      }
    }

    return {
      ImportDeclaration(node) {
        checkSpecifier(node.source, node.source.value)
      },
      ExportNamedDeclaration(node) {
        if (node.source) checkSpecifier(node.source, node.source.value)
      },
      ExportAllDeclaration(node) {
        if (node.source) checkSpecifier(node.source, node.source.value)
      },
      "Program:exit"(node) {
        if (!INDEX_FILE_RE.test(filename)) return
        const body = node.body
        const reexports = body.filter(
          (stmt) =>
            (stmt.type === "ExportNamedDeclaration" && stmt.source) || stmt.type === "ExportAllDeclaration",
        )
        if (reexports.length === 0 || reexports.length !== body.length) return
        context.report({
          node,
          messageId: "indexBarrel",
          data: { name: filename.slice(filename.lastIndexOf("/") + 1) },
        })
      },
    }
  },
}

// -- LAYERING-4 / Law 6 (partial) ----------------------------------------------------------------

/** Files that build their own throwaway test graph rather than wiring a production capability. */
const TEST_FILE_RE = /\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$/

/**
 * LAYERING-4 / module-layering.md Law 6, the one slice of it decidable without whole-application
 * knowledge: a capability declaring `@Global()` on itself.
 *
 * The rest of Law 6 -- which capabilities exist at all, and what starts before what -- has no rule
 * here, and the omission is deliberate, not an oversight. Both need knowledge a single file does
 * not have: "which capabilities exist" is a fact about the whole application graph, and "what
 * starts first" is recorded today as an English comment (`apps/core/src/main.ts`'s side-effect
 * import), which a rule can only pattern-match on wording and would be guessing at meaning, not
 * reading syntax.
 *
 * `isGlobal` passed as a plain, caller-supplied OPTION (`.register({ isGlobal: false })`,
 * `.setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal
 * }))`) is deliberately OUT of scope too, and measuring the reference repository is why: it passes
 * that literal option at every level of nesting, including a capability's own top module wiring its
 * own nested children (`CoreModule.register({ isGlobal: true })` inside `features/api/api.module.ts`,
 * which is nesting, not the sideways declaration Law 6 refuses). Telling "a nested child" from "a
 * foreign capability" needs the module graph -- the exact reason LAYERING-3 stays a documented code
 * rather than an enforced one, and the same reason applies here. `@Global()` carries none of that
 * ambiguity: it declares the module global unconditionally, for every caller, which is precisely
 * the fact Law 6 says only a composition root gets to state.
 */
export const noSelfGlobalModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "LAYERING-4 / module-layering.md Law 6: which capabilities are global is stated only at the composition root -- a capability's own file may not declare itself `@Global()`.",
    },
    schema: [],
    messages: {
      global:
        "`@Global()` declares this module global from inside its own capability. LAYERING-4: whether a capability is global is a fact about the APPLICATION, decided per-application at the composition root (`AiModule.register({ isGlobal: true })` in `apps/*/src/app.module.ts`), not a fact a capability gets to state about itself. Remove the decorator and pass `isGlobal` through as a caller-supplied option instead.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (TEST_FILE_RE.test(filename)) return {}
    const self = selfAliases(filename)
    if (!self || self.prefix === "@tests/") return {}

    return {
      Decorator(node) {
        const expr = node.expression
        const name =
          expr.type === "CallExpression"
            ? expr.callee.type === "Identifier"
              ? expr.callee.name
              : null
            : expr.type === "Identifier"
              ? expr.name
              : null
        if (name === "Global") {
          context.report({ node, messageId: "global" })
        }
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
  "no-self-global-module": noSelfGlobalModule,
  "no-relative-capability-escape": noRelativeCapabilityEscape,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All five measured at zero debt in the reference repository -- the three added alongside
 * `no-folder-reexport`, `no-self-global-module` and `no-relative-capability-escape` fired zero
 * times across the repository's ~4700 `src/**` TypeScript files, verified against a harness that
 * DOES fire on synthetic violations of each (so the zero is measured, not a broken rule going
 * quiet). A repository adopting any of these five into an existing tree will not be at zero: land
 * above zero at `warn` with the count, exactly as the burn-down procedure says.
 */
export const recommended = {
  "starci-be/must-deep-module-import": "error",
  "starci-be/no-self-module-alias": "error",
  "starci-be/no-folder-reexport": "error",
  "starci-be/no-self-global-module": "error",
  "starci-be/no-relative-capability-escape": "error",
}
