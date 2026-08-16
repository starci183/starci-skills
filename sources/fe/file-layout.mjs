/**
 * The rules that hold `file-layout.md`.
 *
 * Four rules locking the same habit: stuffing a cluster into the folder of one screen. It always
 * starts harmlessly - "only this page uses it" - and ends as a page folder holding four components,
 * a constants folder, a utils folder and three hand-copied resting shapes, at which point the
 * screen is a second codebase with its own private vocabulary that nobody else can reuse.
 *
 * Every rule here reads the PATH rather than the contents, which is what makes them cheap and
 * exact. The cost of that choice is stated where it bites: a path rule cannot tell a component from
 * a helper, only a folder from a folder, so each rule below names the destination it sends things
 * to rather than merely refusing.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Tiers whose folder holds exactly the two halves of one surface. */
const TWO_FILE_TIERS = /\/src\/components\/(pages|layouts)\/([^/]+)\/(.+)$/

/** Overlays carry a feature category between the tier and the surface. */
const TWO_FILE_TIERS_WITH_CATEGORY = /\/src\/components\/(overlays)\/[^/]+\/([^/]+)\/(.+)$/

/** The two halves, and the twin test of each, are the whole of what a surface folder may hold. */
const ALLOWED_IN_SURFACE_FOLDER = /^(?:component|index)(?:\.test)?\.tsx?$/

/** Folders that are not component code, whatever they are nested inside. */
const NON_COMPONENT_FOLDERS = /\/src\/components\/.*\/(constants|utils|types|hooks)\//

/** Whether the path sits in ONE surface folder, and what that folder is named. */
const surfaceFolder = (filename) => {
  const file = normalizePath(filename)
  const hit = file.match(TWO_FILE_TIERS) || file.match(TWO_FILE_TIERS_WITH_CATEGORY)
  return hit ? { tier: hit[1], name: hit[2], rest: hit[3] } : null
}

// -- FILE-2 --------------------------------------------------------------------------------------

/** A page, layout or overlay folder holds its two halves and nothing else. */
export const surfaceFolderTwoFilesOnly = {
  meta: {
    type: "problem",
    docs: { description: "A page/layout/overlay folder holds `component.tsx` + `index.tsx` and nothing else." },
    schema: [],
    messages: {
      extra:
        "`{{tier}}/{{name}}/` contains `{{rest}}` - a surface folder holds its two halves ONLY (`component.tsx` is the shape, `index.tsx` is the wiring). Whatever this is, it has a real home: a component of its own goes to `blocks/<category>/`, a closed arrangement to `composites/`, a fetch to `hooks/`, a pure helper to `modules/utils/`, a shape to `modules/types/`, copy or a config map to `resources/`. \"Only this screen uses it\" is how a folder becomes a second codebase.",
    },
  },
  create(context) {
    const folder = surfaceFolder(context.filename || context.getFilename())
    if (!folder || ALLOWED_IN_SURFACE_FOLDER.test(folder.rest)) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "extra", data: folder })
      },
    }
  },
}

// -- FILE-3 --------------------------------------------------------------------------------------

/** What is not component code does not live in the component tree. */
export const noHelperFolderInComponents = {
  meta: {
    type: "problem",
    docs: { description: "`constants/` `utils/` `types/` `hooks/` are not component folders." },
    schema: [],
    messages: {
      helper:
        "`{{kind}}/` under `src/components/**` - this is not component code, so it does not live in the component tree. A fetch is a `hooks/`, a pure function is a `modules/utils/`, a shape is a `modules/types/`, copy or a config map is a `resources/`. Left here it stays invisible to everyone who would have reused it, so the second author writes it again and the two drift.",
    },
  },
  create(context) {
    const hit = normalizePath(context.filename || context.getFilename()).match(NON_COMPONENT_FOLDERS)
    if (!hit) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "helper", data: { kind: hit[1] } })
      },
    }
  },
}

// -- FILE-1 --------------------------------------------------------------------------------------

/** A PascalCase folder exports a family whose name belongs to the folder. */
export const exportMatchesFolder = {
  meta: {
    type: "suggestion",
    docs: { description: "A PascalCase folder exports a direct named-export family matching the folder." },
    schema: [],
    messages: {
      mismatch:
        "`index.tsx` in folder `{{folder}}` has no direct named export belonging to the folder's family (exports: {{names}}). The path is supposed to predict the name, so a reader who knows one knows the other - export `{{folder}}`, or a member like `{{folder}}Root`.",
    },
  },
  create(context) {
    const hit = normalizePath(context.filename || context.getFilename()).match(/\/([A-Z][A-Za-z0-9]*)\/index\.tsx?$/)
    if (!hit) return {}
    const folder = hit[1]
    const names = new Set()
    const belongsToFamily = (name) =>
      name === folder || (name.startsWith(folder) && name.length > folder.length && /^[A-Z]/.test(name.slice(folder.length)))
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration
        if (declaration && declaration.type === "VariableDeclaration") {
          declaration.declarations.forEach((one) => one.id && one.id.name && names.add(one.id.name))
        }
        if (declaration && declaration.type === "FunctionDeclaration" && declaration.id) names.add(declaration.id.name)
        for (const specifier of node.specifiers || []) {
          if (specifier.exported && specifier.exported.name) names.add(specifier.exported.name)
        }
      },
      "Program:exit"(node) {
        if (names.size === 0 || [...names].some(belongsToFamily)) return
        context.report({ node, messageId: "mismatch", data: { folder, names: [...names].join(", ") } })
      },
    }
  },
}

// -- FILE-4 --------------------------------------------------------------------------------------

/** Members that make an object literal look like a component family rather than data. */
const looksLikeComponentMember = (name) => /^[A-Z]/.test(String(name))

/** A folder exports a family, never one runtime object standing in for a namespace. */
export const noRuntimeNamespace = {
  meta: {
    type: "problem",
    docs: { description: "A component family is exported as members, not as one runtime object." },
    schema: [],
    messages: {
      namespace:
        "`{{name}}` is a runtime namespace: one object holding {{members}}. It bundles as a single unit, so a call site importing one member links them all and nothing can be dropped from the build. Export the members directly - the dotted call site is a convenience the bundler pays for.",
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration
        if (!declaration || declaration.type !== "VariableDeclaration") return
        for (const one of declaration.declarations) {
          const name = one.id && one.id.name
          const init = one.init && one.init.type === "TSAsExpression" ? one.init.expression : one.init
          if (!name || !/^[A-Z]/.test(name) || !init || init.type !== "ObjectExpression") continue
          const members = init.properties
            .filter((property) => property.type === "Property" && !property.computed)
            .map((property) => (property.key.type === "Identifier" ? property.key.name : null))
            .filter(Boolean)
          if (members.length < 2 || !members.every(looksLikeComponentMember)) continue
          context.report({ node: one.id, messageId: "namespace", data: { name, members: members.join(", ") } })
        }
      },
    }
  },
}

// -- FILE-5 --------------------------------------------------------------------------------------

/** Tiers that know a feature, and therefore belong to the app that owns it. */
const FEATURE_TIERS = /\/packages\/[^/]+\/src\/(blocks|overlays|pages|layouts)\//

/** Tiers that know no feature, and therefore belong to the shared package. */
const VOCABULARY_TIERS = /\/apps\/[^/]+\/src\/(?:components\/)?(contracts|leaves|composites|branches|shells)\//

/**
 * In a monorepo, the shared package stops below the block.
 *
 * WHY A PATH RULE IS ENOUGH HERE. The feature line is already drawn by the tier name: a leaf knows
 * no domain and a block is a domain sentence, so which side of the workspace each belongs on
 * follows from the folder it is already in. Nothing needs to read the file.
 *
 * WHAT IT COST TO LEARN. A shared package carried one `blocks/FleetRow/` while its own header
 * insisted that "a block carries feature meaning and therefore belongs to the app that owns the
 * feature". The document was right, the tree disagreed, and nothing turned red for either of them -
 * which is the whole argument for this rule rather than the paragraph.
 */
export const monorepoTierBelongsToItsSide = {
  meta: {
    type: "problem",
    docs: {
      description:
        "In a monorepo the shared package holds contracts, leaves, composites, branches and shells; blocks, overlays, layouts and pages belong to the app that owns the feature.",
    },
    schema: [],
    messages: {
      featureInPackage:
        "`{{tier}}/` knows a feature, so it belongs to the app that owns that feature, not to the shared package - every app that never wanted this domain now ships it. Move it to `apps/<app>/src/components/{{tier}}/`.",
      vocabularyInApp:
        "`{{tier}}/` knows no feature, so one copy belongs to every app - left here, the second app writes it again and the two drift with nothing to notice. Move it to `packages/ui/src/{{tier}}/`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const inPackage = file.match(FEATURE_TIERS)
    const inApp = file.match(VOCABULARY_TIERS)
    return {
      Program(node) {
        if (inPackage) {
          context.report({ node, messageId: "featureInPackage", data: { tier: inPackage[1] } })
          return
        }
        if (inApp) context.report({ node, messageId: "vocabularyInApp", data: { tier: inApp[1] } })
      },
    }
  },
}

// -- FILE-6 --------------------------------------------------------------------------------------

/** Anything under a routing tree, in either workspace shape. */
const ROUTE_TREE = /\/src\/app\/(.+)$/

/**
 * What a routing tree is allowed to contain.
 *
 * Next decides these names, not this law: `page`, `layout`, `template`, `loading`, `error`,
 * `not-found`, `global-error`, `default`, `route`, `sitemap`, `robots`, `manifest`, `opengraph-image`
 * and `icon` are framework slots. Two more are admitted because the root layout mounts them and
 * there is nowhere else they could go: `providers`, the client boundary above every route, and
 * `globals`, the stylesheet the document imports. Everything else in that folder is a file somebody
 * put there.
 */
const ROUTE_TREE_FILES =
  /^(?:page|layout|template|loading|error|not-found|global-error|default|route|providers|globals|middleware|sitemap|robots|manifest|opengraph-image|twitter-image|apple-icon|icon|favicon)(?:\.[a-z-]+)?\.(?:tsx?|jsx?|css|json)$/

/** `app/api/**` is server code, not a screen; `_private/**` is Next's own opt-out folder. */
const ROUTE_TREE_EXEMPT = /^(?:api\/|_)/

/**
 * A test sitting beside the thing it tests.
 *
 * EXEMPT, because a test is not a component and cannot become the second page this rule exists to
 * prevent - it ships in no bundle and no route renders it. Refusing it would push route tests out of
 * the one directory where the next reader looks for them, which is the opposite of the twin-test
 * habit every other tier here follows.
 *
 * The name is deliberately not required to match `page` or `layout`. A route's tests split by
 * CONCERN - what the screen renders, who may reach it, where the boundary sits - and forcing them
 * into one `page.test.tsx` would buy nothing but a longer file.
 */
const ROUTE_TREE_TEST = /\.test\.(?:tsx?|jsx?)$/

/**
 * A file under `app/` names which page renders at which URL, and does nothing else.
 *
 * WHY THIS RULE EXISTS RATHER THAN THE PARAGRAPH ALONE. The law said "the route file mounts and
 * nothing else" and had said so for as long as the tier list existed. Nothing checked it. A page
 * owner was written to `app/<segment>/fleet-page.tsx`, carried through a build, a lint run, a
 * typecheck, four sealed screenshots and an approval, and arrived at the edge of a production write
 * with every gate green - because every gate was reading rules, and this one was only prose.
 *
 * WHY IT READS THE FILENAME AND NOT THE CONTENTS. "Drawing" is not a property this can measure: a
 * route that mounts one component and a route that arranges six both return JSX. What CAN be
 * measured exactly is whether a file in the routing tree is one of the framework's own slots. A page
 * owner is a component, a component has a name, and a named component belongs in the tier that
 * groups it with its siblings - `components/pages/<Name>/`, where the next author looks for it.
 *
 * The cost is stated where it bites: a route file that draws inside `page.tsx` still passes. That is
 * FILE-2's `component.tsx` split to catch, and no path rule can see it.
 */
export const routeTreeHoldsRoutesOnly = {
  meta: {
    type: "problem",
    docs: { description: "`src/app/**` holds framework route files only; a page owner lives in `components/pages/<Name>/`." },
    schema: [],
    messages: {
      stray:
        "`app/{{rest}}` is not a route file. A file under `app/` names which page renders at which URL - `page`, `layout`, `loading`, `error` and their siblings are the framework's slots, and `{{basename}}` is not one of them. This is a component, so it belongs where its siblings are: `components/pages/<Name>/` for a screen, `components/blocks/<category>/<Name>/` for a domain sentence. Left here it is the one place nobody looks, and the route has quietly become a second page.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    const hit = file.match(ROUTE_TREE)
    if (!hit) return {}
    const rest = hit[1]
    if (ROUTE_TREE_EXEMPT.test(rest)) return {}
    const basename = rest.slice(rest.lastIndexOf("/") + 1)
    if (ROUTE_TREE_TEST.test(basename)) return {}
    if (ROUTE_TREE_FILES.test(basename)) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "stray", data: { rest, basename } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "surface-folder-two-files-only": surfaceFolderTwoFilesOnly,
  "route-tree-holds-routes-only": routeTreeHoldsRoutesOnly,
  "no-helper-folder-in-components": noHelperFolderInComponents,
  "export-matches-folder": exportMatchesFolder,
  "no-runtime-namespace": noRuntimeNamespace,
  "monorepo-tier-belongs-to-its-side": monorepoTierBelongsToItsSide,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * `export-matches-folder` is the one worth adopting at `warn` first in an existing tree: it fires
 * on every folder whose convention predates the rule, and that count is a migration rather than a
 * defect.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
