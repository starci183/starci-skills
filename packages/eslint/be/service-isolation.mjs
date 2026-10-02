/**
 * The rule that keeps the services of one product apart (catalog R148 `BE_SERVICE_ISOLATION`).
 *
 * A back-end service is a Nest app at `be/apps/<service>/` of the one repository; services share the `be/src` libraries and talk
 * to each other only through the wire (a client of the sibling's API, or the events of its vendored contract under
 * `be/contracts/<service>/`). One service importing a file of another service's `apps/<other>/` folder reaches into a sibling's
 * composition and options, which makes the two one deployable. The check asks the HFS slot view which app owns a file (the owner of
 * an `apps/<app>/src/` slot) for both the importing file and the file the specifier resolves to, through a relative path or the
 * program's own `compilerOptions.paths`; it never matches a path by name.
 */
import { posix } from "node:path"
import { hfsOf } from "./lib/hfs.mjs"
import { typed } from "./lib/types.mjs"

/** The app slots: the slot ids of a service app's `apps/<app>/src/` folder. */
const isAppSlot = (slotId) => typeof slotId === "string" && slotId.startsWith("be.app.")

/** The absolute path (no extension) an alias specifier maps to under `compilerOptions.paths`, or null. */
const resolveAlias = (context, specifier) => {
  const options = typed(context).program.getCompilerOptions()
  const base = options.baseUrl ?? options.pathsBasePath
  if (!options.paths || typeof base !== "string") return null
  for (const [pattern, targets] of Object.entries(options.paths)) {
    if (!pattern.endsWith("/*") || !targets[0]) continue
    const prefix = pattern.slice(0, -1)
    if (!specifier.startsWith(prefix)) continue
    return posix.normalize(`${base.replaceAll("\\", "/")}/${targets[0].replace("*", specifier.slice(prefix.length))}`)
  }
  return null
}

const isRelative = (specifier) => specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../")

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

/** A file of one service app imports no file of a sibling service app. */
export const serviceIsolation = {
  meta: {
    type: "problem",
    docs: { description: "A service app (`apps/<service>/`) imports no file of a sibling service app; services share only the `src` libraries and meet through the wire." },
    schema: [],
    messages: {
      sibling:
        "`{{specifier}}` reaches into the service app `{{other}}` from `{{self}}`. Services share only the `src` libraries; call the sibling through its API client or consume its events through the vendored contract (`be/contracts/{{other}}/`).",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const hfs = hfsOf(context)
    if (!isAppSlot(hfs.slotOf(filename))) return {}
    const self = hfs.ownerOf(filename)
    if (!self) return {}
    return onSpecifiers((node, specifier) => {
      if (typeof specifier !== "string") return
      const target = isRelative(specifier)
        ? posix.normalize(`${posix.dirname(filename.replaceAll("\\", "/"))}/${specifier}`)
        : resolveAlias(context, specifier)
      if (!target) return
      const reached = [`${target}.ts`, `${target}/index.ts`].find((candidate) => isAppSlot(hfs.slotOf(candidate)))
      if (!reached) return
      const other = hfs.ownerOf(reached)
      if (!other || other === self) return
      context.report({ node, messageId: "sibling", data: { specifier, self: posix.basename(posix.dirname(self)), other: posix.basename(posix.dirname(other)) } })
    })
  },
}

export const rules = {
  "service-isolation": serviceIsolation,
}

/** The level this law asks for: `error`, switched off nowhere. */
export const recommended = {
  "starci-be/service-isolation": "error",
}
