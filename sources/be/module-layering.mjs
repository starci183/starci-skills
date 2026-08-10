/**
 * The rules that hold `module-layering.mjs`'s law file, `module-layering.md`.
 *
 * Two rules, both reading import specifiers against the path of the file doing the importing. They
 * are cheap and exact, which is the whole reason they can be `error`.
 *
 * LAYERING-3 (a capability module importing a sibling capability) is NOT here, and the omission is
 * deliberate rather than an oversight: deciding whether an imported module is a sibling capability
 * or a nested child needs the module graph, and a rule reading one file at a time cannot see it. In
 * the reference repository that rule exists and is scoped by path glob; a repository adopting this
 * law should port it as a gate that walks the tree, not as a per-file rule that guesses.
 *
 * THE META-ROOT IS THE TRAP IN BOTH RULES. Some capabilities sit behind a category folder
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "must-deep-module-import": mustDeepModuleImport,
  "no-self-module-alias": noSelfModuleAlias,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Both measured at zero debt in the reference repository. A repository adopting them into an
 * existing tree will not be at zero: barrels are the default in most codebases, so measure first
 * and land above zero at `warn` with the count, exactly as the burn-down procedure says.
 */
export const recommended = {
  "starci-be/must-deep-module-import": "error",
  "starci-be/no-self-module-alias": "error",
}
