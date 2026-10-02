/**
 * The rules that hold `file-layout.md`.
 *
 * Four rules locking the same habit: stuffing a cluster into the folder of one screen. It always
 * starts harmlessly - "only this page uses it" - and ends as a page folder holding four components,
 * a constants folder, a utils folder and three hand-copied resting shapes, at which point the
 * screen is a second codebase with its own private vocabulary that nobody else can reuse.
 *
 * Every rule here asks the HFS slot view where the file sits (slot, layer kind, role, tier) rather than
 * reading the contents, which is what makes them cheap and exact. The cost of that choice is stated where it
 * bites: a slot cannot tell a component from a helper, only a folder from a folder, so each rule below names the
 * destination it sends things to rather than merely refusing.
 */

import { hfsOf } from "./lib/hfs.mjs"
import { classOf, fileOf, inSlot, isComponentFile, kindOfFile, roleOfFile, tierOfFile } from "./lib/scope.mjs"

/** The path segments of the linted file below the folder of its owner (the slot's `root`), directories only. */
const dirsBelowRoot = (context) => {
  const { root } = classOf(context)
  const relative = hfsOf(context).relative(fileOf(context))
  return relative.slice(root.length + 1).split("/").slice(0, -1)
}

/** The folder segment that sits where a component layer folder is expected but is not one, or null: `components/shells/`, `src/shells/`. */
const unknownLayerFolder = (context) => {
  const hfs = hfsOf(context)
  const file = fileOf(context)
  const found = hfs.classify(file)
  const relative = hfs.relative(file)
  if (found.status === "no-slot" && found.nearest?.slot === "fe.components") {
    const prefix = found.nearest.matchedPrefix
    return relative.startsWith(`${prefix}/`) ? (relative.slice(prefix.length + 1).split("/")[0] ?? null) : null
  }
  if (found.slot === "fe.package.ui" && !found.kind) {
    const [folder, layer, ...rest] = relative.slice(found.root.length + 1).split("/")
    return folder === "src" && rest.length > 0 ? layer : null
  }
  return null
}

/** Folders whose contents are not component code, whatever they are nested inside. */
const NON_COMPONENT_FOLDERS = new Set(["constants", "utils", "types", "hooks"])

/**
 * The surface folder a feature-kind file sits in: its kind (`pages`, `layouts`, `overlays`), the surface name and the
 * file's path inside it. A page or layout owner IS the surface folder; an overlay owner is its category and the
 * surface is the folder below it.
 */
const surfaceFolder = (context) => {
  if (!inSlot(context, "fe.feature")) return null
  const { kind, bindings, root } = classOf(context)
  const below = hfsOf(context).relative(fileOf(context)).slice(root.length + 1).split("/")
  if (kind === "overlays") return below.length > 1 ? { tier: kind, name: below[0], rest: below.slice(1).join("/") } : null
  return { tier: kind, name: bindings.name, rest: below.join("/") }
}

/** A file a surface folder may hold: one of the slot's roles (entry, drawing, styles), directly in the folder. */
const belongsInSurfaceFolder = (context, folder) =>
  !folder.rest.includes("/") && roleOfFile(context) !== null

// -- FILE-2 --------------------------------------------------------------------------------------

/** A page, layout or overlay folder holds its two halves and its colocated class-name module. */
export const surfaceFolderTwoFilesOnly = {
  meta: {
    type: "problem",
    docs: { description: "A page/layout/overlay folder holds `component.tsx` + `index.tsx` and nothing else." },
    schema: [],
    messages: {
      extra:
        "`{{tier}}/{{name}}/` contains `{{rest}}` - a surface folder holds `component.tsx`, `index.tsx`, and an optional `classNames.ts`. Whatever else this is has a real home: a component of its own goes to `blocks/<category>/`, a closed arrangement to `composites/`, a fetch to `hooks/`, a pure helper to `modules/utils/`, a shape to `modules/types/`, copy or a config map to `resources/`.",
    },
  },
  create(context) {
    const folder = surfaceFolder(context)
    if (!folder || belongsInSurfaceFolder(context, folder)) return {}
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
        "`{{kind}}/` under a component owner - this is not component code, so it does not live in the component tree. A fetch is a `hooks/`, a pure function is a `modules/utils/`, a shape is a `modules/types/`, copy or a config map is a `resources/`. Left here it stays invisible to everyone who would have reused it, so the second author writes it again and the two drift.",
    },
  },
  create(context) {
    if (!isComponentFile(context)) return {}
    const dirs = dirsBelowRoot(context)
    // a package owner sits at the package root, so its `src/<layer>/<name>` prefix is not part of the owner
    const inside = inSlot(context, "fe.package.ui") ? dirs.slice(3) : dirs
    const folder = inside.find((name) => NON_COMPONENT_FOLDERS.has(name))
    if (!folder) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "helper", data: { kind: folder } })
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
    if (roleOfFile(context) !== "entry" || kindOfFile(context) === null) return {}
    const folder = hfsOf(context).relative(fileOf(context)).split("/").slice(-2)[0]
    if (!/^[A-Z][A-Za-z0-9]*$/.test(folder)) return {}
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

/**
 * Whether the repository declares the shared UI package (slot `fe.package.ui` is opt-in): the classification of a file
 * of the package's own root is `owned` only then.
 */
const uiPackageDeclared = (hfs) => {
  const root = hfs.slot("fe.package.ui").path.replace(/<[^>]+>/g, "probe").replace(/\/$/, "")
  return hfs.classify(`${root}/package.json`).status === "owned"
}

/** The layer folders that know a feature: those a component owner or a feature owner has and the shared package does not. */
const featureTiers = (hfs) => {
  const shared = new Set(hfs.slot("fe.package.ui").kinds)
  return new Set([...hfs.slot("fe.components").layers, ...hfs.slot("fe.feature").kinds].filter((name) => !shared.has(name)))
}

/**
 * In a monorepo, the shared package stops below the block.
 *
 * WHY THE SLOT IS ENOUGH HERE. The feature line is already drawn by the layer: a leaf knows
 * no domain and a block is a domain sentence, so which side of the workspace each belongs on
 * follows from the layer the slot reports. The layers a shared package may hold are the `kinds` of
 * `fe.package.ui`; an app holds the shared ones only when the repository declares that package.
 *
 * WHAT IT COST TO LEARN. A shared package carried one `blocks/WorkerRow/` while its own header
 * insisted that "a block carries feature meaning and therefore belongs to the app that owns the
 * feature". The document was right, the tree disagreed, and nothing turned red for either of them -
 * which is the whole argument for this rule rather than the paragraph.
 */
export const monorepoTierBelongsToItsSide = {
  meta: {
    type: "problem",
    docs: {
      description:
        "In a monorepo the shared package holds leaves, composites and branches; blocks, overlays, layouts and pages belong to the app that owns the feature.",
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
    const hfs = hfsOf(context)
    const folder = unknownLayerFolder(context)
    const inPackage = inSlot(context, "fe.package.ui") && folder !== null && featureTiers(hfs).has(folder) ? folder : null
    const tier = kindOfFile(context)
    const inApp = inSlot(context, "fe.components") && tier !== null && hfs.slot("fe.package.ui").kinds.includes(tier) && uiPackageDeclared(hfs) ? tier : null
    return {
      Program(node) {
        if (inPackage) {
          context.report({ node, messageId: "featureInPackage", data: { tier: inPackage } })
          return
        }
        if (inApp) context.report({ node, messageId: "vocabularyInApp", data: { tier: inApp } })
      },
    }
  },
}

// -- FILE-6 --------------------------------------------------------------------------------------

/**
 * A file under `app/` names which page renders at which URL, and does nothing else.
 *
 * WHY THIS RULE EXISTS RATHER THAN THE PARAGRAPH ALONE. The law said "the route file mounts and
 * nothing else" and had said so for as long as the tier list existed. Nothing checked it. A page
 * owner was written to `app/<segment>/workers-page.tsx`, carried through a build, a lint run, a
 * typecheck, four sealed screenshots and an approval, and arrived at the edge of a production write
 * with every gate green - because every gate was reading rules, and this one was only prose.
 *
 * WHY IT READS THE SLOT AND NOT THE CONTENTS. "Drawing" is not a property this can measure: a
 * route that mounts one component and a route that arranges six both return JSX. What CAN be
 * measured exactly is whether a file in the routing tree (slot `fe.route`) is one of the framework's own slots. A page
 * owner is a component, a component has a name, and a named component belongs in the tier that
 * groups it with its siblings - `components/pages/<Name>/`, where the next author looks for it.
 *
 * The cost is stated where it bites: a route file that draws inside `page.tsx` still passes. That is
 * FILE-2's `component.tsx` split to catch, and no path rule can see it.
 */
export const routeTreeHoldsRoutesOnly = {
  meta: {
    type: "problem",
    docs: { description: "`src/app/**` holds framework route files only; a page owner lives in `features/pages/<Name>/`." },
    schema: [],
    messages: {
      stray:
        "`app/{{rest}}` is not a route file. A file under `app/` names which page renders at which URL - `page`, `layout`, `loading`, `error` and their siblings are the framework's slots, and `{{basename}}` is not one of them. This is a component, so it belongs where its siblings are: `features/pages/<Name>/` for a screen, `components/blocks/<category>/<Name>/` for a domain sentence. Left here it is the one place nobody looks, and the route has quietly become a second page.",
    },
  },
  create(context) {
    if (!inSlot(context, "fe.route")) return {}
    const verdict = hfsOf(context).allows(fileOf(context))
    if (!verdict || verdict.allowed) return {}
    const rest = verdict.relative
    const basename = rest.slice(rest.lastIndexOf("/") + 1)
    return {
      Program(node) {
        context.report({ node, messageId: "stray", data: { rest, basename } })
      },
    }
  },
}

function propertyName(node) {
  if (node.key?.type === "Identifier") return node.key.name
  if (node.key?.type === "Literal") return node.key.value
  return null
}

/** `meta.shape` must tell the same truth as the source path. */
export const sourceTierMarkerMatchesFolder = {
  meta: {
    type: "problem",
    docs: { description: "A source tier marker matches the component folder that owns it." },
    schema: [],
    messages: {
      mismatch:
        "This file sits in `{{tier}}/` but declares `meta.shape = {{shape}}`. A source marker is evidence, not a second classification; change the owner or the marker so the path and source agree.",
    },
  },
  create(context) {
    const tier = kindOfFile(context)
    if (tier === null) return {}
    const expected = {
      blocks: "block",
      branches: "branch",
      composites: "composite",
      layouts: "layout",
      leaves: "leaf",
      overlays: "overlay",
      pages: "page",
    }[tier]
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration
        if (!declaration || declaration.type !== "VariableDeclaration") return
        for (const item of declaration.declarations || []) {
          if (item.id?.type !== "Identifier" || item.id.name !== "meta") continue
          let init = item.init
          while (init && (init.type === "TSAsExpression" || init.type === "TSSatisfiesExpression")) init = init.expression
          if (!init || init.type !== "ObjectExpression") continue
          const shapeProperty = init.properties.find((property) =>
            property.type === "Property" && !property.computed && propertyName(property) === "shape")
          const shape = shapeProperty?.value?.type === "Literal" ? shapeProperty.value.value : null
          if (typeof shape === "string" && shape !== expected) {
            context.report({ node: shapeProperty.value, messageId: "mismatch", data: { tier, shape } })
          }
        }
      },
    }
  },
}

/** `shells/` no longer exists; vendor mechanics are closed named branches. */
export const noShellTier = {
  meta: {
    type: "problem",
    docs: { description: "The component vocabulary has no shell tier." },
    schema: [],
    messages: {
      shell:
        "`shells/` is an untyped branch exemption. Move the owner to a named branch and keep vendor mechanics closed there.",
    },
  },
  create(context) {
    if (unknownLayerFolder(context) !== "shells") return {}
    return { Program(node) { context.report({ node, messageId: "shell" }) } }
  },
}

/**
 * The component a route slot mounts takes the slot's own name.
 *
 * `page.tsx` default-exports `Page`, `layout.tsx` default-exports `Layout`, and so on through
 * the component slots. The filename already tells the framework what the file is; the export
 * name is what the reader and the search results get, and a slot that calls its component
 * `LandingPage` or `AuthenticationRoute` invents a second name for a file that already has a
 * fixed one. The page OWNER - the component that draws the screen - keeps its own name and
 * lives in `components/pages/`; the slot is a shell that mounts it, and a shell named `Page`
 * says exactly that.
 *
 * `default` is deliberately absent: a parallel-route default mirrors whichever page it stands
 * in for, so its name is a decision rather than a constant. `route`, `providers`, `globals`
 * and the asset slots export no component and are not here.
 */
const ROUTE_SLOT_NAME = {
  page: "Page",
  layout: "Layout",
  template: "Template",
  loading: "Loading",
  // Not `Error`: that name shadows the global Error constructor (Sonar typescript:S2137, a bug), and React calls this
  // component an error boundary.
  error: "ErrorBoundary",
  "global-error": "GlobalError",
  "not-found": "NotFound",
}

export const routeSlotFixedName = {
  meta: {
    type: "problem",
    docs: { description: "A route slot file default-exports a component named after the slot." },
    schema: [],
    messages: {
      wrong:
        "`{{basename}}` default-exports `{{actual}}`. A route slot takes the slot's own name - rename it `{{expected}}` and keep the drawing in the page owner under `features/pages/` (the slot is a shell that mounts it).",
      anonymous:
        "`{{basename}}` default-exports an anonymous component. A route slot takes the slot's own name - `const {{expected}} = () => <Owner />` then `export default {{expected}}`.",
      missing:
        "`{{basename}}` has no default export. A route slot's job is to mount its component - default-export `{{expected}}`.",
    },
  },
  create(context) {
    if (!inSlot(context, "fe.route")) return {}
    const expected = ROUTE_SLOT_NAME[roleOfFile(context)]
    if (!expected) return {}
    const file = hfsOf(context).relative(fileOf(context))
    const basename = file.slice(file.lastIndexOf("/") + 1)
    let seen = false
    const report = (node, actual) =>
      context.report({
        node,
        messageId: actual === null ? "anonymous" : "wrong",
        data: { basename, actual: actual ?? "(anonymous)", expected },
      })
    return {
      ExportDefaultDeclaration(node) {
        seen = true
        const declaration = node.declaration
        if (declaration.type === "Identifier") {
          if (declaration.name !== expected) report(node, declaration.name)
          return
        }
        if (
          (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") &&
          declaration.id
        ) {
          if (declaration.id.name !== expected) report(node, declaration.id.name)
          return
        }
        report(node, null)
      },
      ExportNamedDeclaration(node) {
        for (const specifier of node.specifiers || []) {
          if (specifier.exported?.name !== "default") continue
          seen = true
          const local = specifier.local?.name ?? null
          if (local !== expected) report(node, local)
        }
      },
      "Program:exit"(node) {
        if (!seen) context.report({ node, messageId: "missing", data: { basename, expected } })
      },
    }
  },
}

export const rules = {
  "no-shell-tier": noShellTier,
  "source-tier-marker-matches-folder": sourceTierMarkerMatchesFolder,
  "surface-folder-two-files-only": surfaceFolderTwoFilesOnly,
  "route-tree-holds-routes-only": routeTreeHoldsRoutesOnly,
  "route-slot-fixed-name": routeSlotFixedName,
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
