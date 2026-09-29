/**
 * The rules that hold `e2e-shape.md` (HFS R66, `FE_E2E_SHAPE`).
 *
 * THESE RULES GOVERN THE E2E TREE, NOT `src/`. `starciFeConfig` attaches them to `e2e/**` and
 * `playwright.config.*`; every rule here also scopes itself by path, so a config that reaches it by
 * mistake governs nothing it should not.
 *
 * WHY THE SHAPE IS FIXED. An e2e suite is the only proof that the whole app works, and it is run by
 * hand, so it rots quietly: absolute paths that exist on one machine, a Docker dependency that makes
 * it unrunnable in CI, a helper that writes into the OTHER repository's tree, a `test.skip` that
 * turns a missing environment into a green run, and helpers whose untyped parameters hide the fields
 * a test depends on. One layout - `e2e/<area>/<name>.e2e-spec.ts`, three viewports, typed helpers -
 * is what lets the land gate check it statically even though it cannot run it.
 *
 * WHAT IS NOT HERE. That `typecheck:e2e` runs before `test:e2e` is a `package.json` fact (the
 * architecture machine reads it); that the specs pass is the run itself.
 */

import { isE2eFile } from "./lib/scope.mjs"
import { baseName } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The three viewports every e2e project set covers, as `width x height`. */
export const VIEWPORTS = Object.freeze(["1440x900", "768x1024", "390x844"])

/** A file that reads like a spec, by any of the common spellings. */
const SPEC_LIKE = /(?:\.|-)(?:e2e-)?(?:spec|test)\.[cm]?tsx?$/

/** The one legal spec path: `e2e/<area>/<name>.e2e-spec.ts`. */
const SPEC_PATH = /(?:^|\/)e2e\/[^/]+\/[^/]+\.e2e-spec\.ts$/

/** Helper folders: not specs, and never spec-named. */
const HELPER_PATH = /(?:^|\/)e2e\/(?:support|fixtures)\//

/** An absolute filesystem path: a drive, a UNC share, or a well-known root. */
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|home|tmp|mnt|var|opt|etc|root|d|c)\/)/

/** A `..` segment in a path string. */
const PARENT_SEGMENT = /(?:^|[\\/])\.\.(?:[\\/]|$)/

/** Static string of a literal or an expression-free template, else null. */
const staticString = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("")
  return null
}

/** Every string in a subtree, so `path.join(__dirname, "..", "..")` is read as its parts. */
const stringsIn = (node, source) => {
  const found = []
  const walk = (current) => {
    if (!current || typeof current.type !== "string") return
    const text = staticString(current)
    if (text !== null) found.push(text)
    for (const key of source.visitorKeys[current.type] ?? []) {
      const child = current[key]
      if (Array.isArray(child)) child.forEach(walk)
      else walk(child)
    }
  }
  walk(node)
  return found
}

// -- E2E-1 -----------------------------------------------------------------------------------------

/** Specs live at `e2e/<area>/<name>.e2e-spec.ts`. */
export const e2eSpecLocation = {
  meta: {
    type: "problem",
    docs: { description: "An e2e spec is `e2e/<area>/<name>.e2e-spec.ts`; helpers live under `support/` or `fixtures/`." },
    schema: [],
    messages: {
      location:
        "`{{name}}` is not at `e2e/<area>/<name>.e2e-spec.ts`. One shape - an area folder, the `.e2e-spec.ts` suffix - is what lets the gate find every spec without running them; helpers go in `e2e/support/` or `e2e/fixtures/` and are never named like a spec.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/(?:^|\/)e2e\//.test(file)) return {}
    const name = baseName(file)
    const helper = HELPER_PATH.test(file)
    const specLike = SPEC_LIKE.test(name)
    const legal = SPEC_PATH.test(file) && !helper
    if ((specLike && !legal) || (helper && /\.e2e-spec\./.test(name))) {
      return { Program: (node) => context.report({ node, messageId: "location", data: { name } }) }
    }
    return {}
  },
}

// -- E2E-2 -----------------------------------------------------------------------------------------

/** No absolute path in e2e source. */
export const e2eNoAbsolutePath = {
  meta: {
    type: "problem",
    docs: { description: "No absolute filesystem path in e2e source." },
    schema: [],
    messages: {
      absolute:
        "An absolute path (`{{path}}`). It exists on one machine and nowhere else, so the suite passes locally and cannot run in CI or on another machine. Build the path from the config or the test's own directory.",
    },
  },
  create(context) {
    if (!isE2eFile(context.filename || context.getFilename())) return {}
    const check = (node, text) => {
      if (typeof text === "string" && ABSOLUTE_PATH.test(text)) context.report({ node, messageId: "absolute", data: { path: text } })
    }
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value && node.value.cooked),
    }
  },
}

// -- E2E-3 -----------------------------------------------------------------------------------------

/** Container tooling that an e2e suite must not depend on. */
const DOCKER_MODULE = /^(?:dockerode|testcontainers|@testcontainers\/.+|docker-compose)$/

/** A command or string that starts Docker. */
const DOCKER_TEXT = /\bdocker(?:-compose)?\b|\bdocker\s+compose\b/i

/** No Docker in e2e. */
export const e2eNoDocker = {
  meta: {
    type: "problem",
    docs: { description: "An e2e suite does not start or require Docker." },
    schema: [],
    messages: {
      docker:
        "Docker in an e2e suite. A suite that needs a container runtime cannot run where the app can, and it hides the real prerequisite (a running app and backend) behind a tool. Point the suite at a URL from the config and let the environment provide the stack.",
    },
  },
  create(context) {
    if (!isE2eFile(context.filename || context.getFilename())) return {}
    return {
      ImportDeclaration(node) {
        if (DOCKER_MODULE.test(String(node.source.value))) context.report({ node, messageId: "docker" })
      },
      Literal(node) {
        if (typeof node.value === "string" && DOCKER_TEXT.test(node.value)) context.report({ node, messageId: "docker" })
      },
      TemplateElement(node) {
        if (DOCKER_TEXT.test((node.value && node.value.cooked) || "")) context.report({ node, messageId: "docker" })
      },
    }
  },
}

// -- E2E-4 -----------------------------------------------------------------------------------------

/** Filesystem calls that write, move or remove. */
const FS_WRITE = new Set([
  "writeFile",
  "writeFileSync",
  "appendFile",
  "appendFileSync",
  "mkdir",
  "mkdirSync",
  "rm",
  "rmSync",
  "rmdir",
  "rmdirSync",
  "copyFile",
  "copyFileSync",
  "cp",
  "cpSync",
  "rename",
  "renameSync",
  "unlink",
  "unlinkSync",
  "createWriteStream",
])

/** The name a call is made through: `writeFile` or `fs.writeFile` or `fs.promises.writeFile`. */
const calleeName = (callee) => {
  if (callee.type === "Identifier") return callee.name
  if (callee.type === "MemberExpression" && !callee.computed) return callee.property.name
  return null
}

/** No e2e write outside the repository's own tree. */
export const e2eNoCrossRepoWrite = {
  meta: {
    type: "problem",
    docs: { description: "An e2e file write never targets an absolute path or climbs out of the repository." },
    schema: [],
    messages: {
      write:
        "This file operation writes to a path that is absolute or climbs out with `..`. An e2e run that writes into another repository (the backend's tree, a shared folder) changes state it does not own, and its result depends on a checkout layout. Write under this repository's own output folder.",
    },
  },
  create(context) {
    if (!isE2eFile(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (!name || !FS_WRITE.has(name)) return
        const strings = node.arguments.flatMap((argument) => stringsIn(argument, source))
        if (strings.some((text) => ABSOLUTE_PATH.test(text) || PARENT_SEGMENT.test(text) || text === "..")) {
          context.report({ node, messageId: "write" })
        }
      },
    }
  },
}

// -- E2E-5 -----------------------------------------------------------------------------------------

/** The root identifier of a member chain: `test` in `test.describe.skip`. */
const chainRoot = (node) => {
  let current = node
  while (current && current.type === "MemberExpression") current = current.object
  return current && current.type === "Identifier" ? current.name : null
}

/** No skipped test: a missing environment is a failure. */
export const e2eNoSkip = {
  meta: {
    type: "problem",
    docs: { description: "No `test.skip`, `test.fixme` or `describe.skip`: a missing environment fails the run." },
    schema: [],
    messages: {
      skip:
        "A skipped test. Skipping because the environment is missing turns \"the suite cannot run\" into a green run, which is the one result an e2e suite must never give. Fix the environment, or delete the test.",
    },
  },
  create(context) {
    if (!isE2eFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (!["skip", "fixme"].includes(callee.property.name)) return
        if (["test", "it", "describe"].includes(chainRoot(callee.object))) context.report({ node, messageId: "skip" })
      },
    }
  },
}

// -- E2E-6 -----------------------------------------------------------------------------------------

/** True when a function is a module-level helper: declared, or bound to a top-level `const`. */
const isModuleLevel = (node) => {
  let current = node.parent
  if (node.type !== "FunctionDeclaration") {
    if (!current || current.type !== "VariableDeclarator") return false
    current = current.parent && current.parent.parent
  }
  return Boolean(current) && ["Program", "ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(current.type)
}

/** Helpers carry types; nothing is `any`. */
export const e2eTypedHelpers = {
  meta: {
    type: "problem",
    docs: { description: "e2e helper parameters are typed and nothing is `any`." },
    schema: [],
    messages: {
      untyped:
        "A helper parameter with no type. A test depends on the fields a helper takes and returns; untyped, a renamed field fails at run time in a test nobody touched. Annotate the parameter.",
      any: "`any` in e2e source. It turns the compiler off for the value a test asserts on. Type it, or narrow from `unknown`.",
    },
  },
  create(context) {
    if (!isE2eFile(context.filename || context.getFilename())) return {}
    const checkParams = (node) => {
      if (!isModuleLevel(node)) return
      for (const parameter of node.params) {
        const target = parameter.type === "AssignmentPattern" ? parameter.left : parameter
        // A default value gives the parameter a type the compiler infers.
        if (parameter.type === "AssignmentPattern" && parameter.right.type === "Literal") continue
        if (target.type === "RestElement") {
          if (!target.typeAnnotation) context.report({ node: target, messageId: "untyped" })
          continue
        }
        if (!target.typeAnnotation) context.report({ node: target, messageId: "untyped" })
      }
    }
    return {
      FunctionDeclaration: checkParams,
      ArrowFunctionExpression: checkParams,
      FunctionExpression: checkParams,
      TSAnyKeyword(node) {
        context.report({ node, messageId: "any" })
      },
    }
  },
}

// -- E2E-7 -----------------------------------------------------------------------------------------

/** Every Playwright config declares exactly the three viewports. */
export const playwrightViewports = {
  meta: {
    type: "problem",
    docs: { description: `playwright.config declares the viewports ${VIEWPORTS.join(", ")} and no others.` },
    schema: [],
    messages: {
      missing:
        "The Playwright config does not declare the viewport {{size}}. Every app is proved at 1440x900, 768x1024 and 390x844 so a layout that only works on a desktop screen fails here.",
      extra:
        "The Playwright config declares the viewport {{size}}, which is not one of 1440x900, 768x1024, 390x844. A fourth size is a fourth thing to keep passing that no design covers.",
    },
  },
  create(context) {
    if (!/^playwright\.config\.[cm]?[jt]s$/.test(baseName(context.filename || context.getFilename()))) return {}
    const seen = new Map()
    return {
      Property(node) {
        if (node.computed || node.key.type !== "Identifier" || node.key.name !== "viewport") return
        if (node.value.type !== "ObjectExpression") return
        const field = (name) => {
          const property = node.value.properties.find((p) => p.type === "Property" && p.key.type === "Identifier" && p.key.name === name)
          return property && property.value.type === "Literal" ? property.value.value : null
        }
        const width = field("width")
        const height = field("height")
        if (typeof width === "number" && typeof height === "number") seen.set(`${width}x${height}`, node)
      },
      "Program:exit"(program) {
        for (const size of VIEWPORTS) if (!seen.has(size)) context.report({ node: program, messageId: "missing", data: { size } })
        for (const [size, node] of seen) if (!VIEWPORTS.includes(size)) context.report({ node, messageId: "extra", data: { size } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "e2e-spec-location": e2eSpecLocation,
  "e2e-no-absolute-path": e2eNoAbsolutePath,
  "e2e-no-docker": e2eNoDocker,
  "e2e-no-cross-repo-write": e2eNoCrossRepoWrite,
  "e2e-no-skip": e2eNoSkip,
  "e2e-typed-helpers": e2eTypedHelpers,
  "playwright-viewports": playwrightViewports,
}

/** Which tree these rules govern: the factory attaches them to `e2e/**`, not to `src/**`. */
export const scope = "e2e"

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
