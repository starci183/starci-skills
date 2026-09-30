/**
 * The one door between the rules and the numbers of the HFS slot manifest.
 *
 * A rule whose limit is a repository-wide parameter (`ruleParams.fe` of `knowledge/hfs/slots.yaml`) never states the
 * number itself: the manifest is the only place a number lives, so the lint, the architecture machine and the report
 * cannot disagree. The package ships its own byte copy of the manifest and its loader in `runtime/`
 * (`packages/hfs/scripts/sync-runtime.mjs` keeps it equal to the runtime's), so a repository that has no runtime
 * checkout reads the same numbers. A rule takes no option: there is nothing to tune per repository.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadSlotManifest, ruleParams } from "../runtime/scripts/lib/hfs-slots.mjs"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime")

/** The front-end parameters of the shipped manifest, read once. */
export const feParams = ruleParams(loadSlotManifest({ root: RUNTIME }), "fe")
