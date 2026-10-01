/**
 * The rules that read the project graph: the findings of the architecture machine that sit on a TypeScript file.
 *
 * One graph per lint run: `scripts/hfs/project-graph.mjs` (a byte copy in this package's runtime/) builds the machine's module
 * graph and slot manifest once for the repository, caches it, and each rule below reports the findings of its own codes on
 * the file ESLint is visiting, on the line the machine names. There is no second graph and no second judge: the list of
 * rules and their codes is `LINT_ENFORCERS` of the machine (scripts/hfs/architecture/surface.mjs); `hfs check` keeps the
 * findings that have no TypeScript file to sit on. A graph that cannot be built stops the run with the machine's message.
 */
import { LINT_ENFORCERS } from "./runtime/scripts/hfs/architecture/surface.mjs"
import { projectRule } from "./runtime/scripts/hfs/project-rule.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "runtime")
const mine = LINT_ENFORCERS.filter((enforcer) => enforcer.plugins.includes("fe"))

/** The rules this law contributes to the plugin: one per graph enforcer of this profile. */
export const rules = Object.fromEntries(mine.map((e) => [e.id, projectRule({ enforcer: e, runtimeRoot: RUNTIME, hfsOf })]))

/** Every one at error. */
export const recommended = Object.fromEntries(mine.map((e) => [`starci-fe/${e.id}`, "error"]))
