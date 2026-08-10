/**
 * The parity gate: every law has its artifact, and every artifact has its law.
 *
 *   node --test parity.test.mjs
 *
 * WHY THIS EXISTS. A law and the thing that enforces it are two files, and two files drift. The
 * drift is silent in both directions and both directions are bad: a law with no artifact reads as
 * enforced when nothing holds it, and an artifact with no law is a rule somebody hits in review with
 * no document to argue with. Neither shows up in a build.
 *
 * It was written after all three failure modes happened at once, within an hour of each other:
 * a rule module filed under one axis while its law sat under another, so the names no longer lined
 * up; three rule modules landing with no law files at all; and a promise to write this gate that
 * went unkept long enough for the first two to happen. A convention nobody checks is a preference.
 *
 * THE CONVENTION IT HOLDS. For each axis, a law at `<axis>/canon/patterns/<name>.md` is held by
 * `sources/<axis>/<name>.mjs` and its twin `sources/<axis>/<name>.test.mjs`. Type fences carry no
 * rules and are exempt by extension - they are enforced by the compiler, which needs no test of its
 * own here.
 */
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"

/** The canon root, resolved from this file so the gate travels with the tree. */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** The axes that carry laws. Adding one here is what makes its shelf checked. */
const AXES = ["fe", "be"]

/** Files in `sources/<axis>` that are fences rather than rules, and so need no law and no test. */
const isTypeFence = (name) => name.endsWith(".ts")

/**
 * The one module per axis that GATHERS rules instead of declaring any.
 *
 * It has no law because it states none: every rule it exposes is owned by a law module beside it,
 * and its own twin test proves exactly that. This is a structural role rather than an exemption -
 * a second file claiming it would be two plugins for one axis, which is a different problem.
 */
const AGGREGATOR = "index"

/** Rule modules in one axis: the `.mjs` files that are not twins, fences, or the aggregator. */
const ruleModules = (axis) => {
  const dir = join(ROOT, "sources", axis)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs") && !isTypeFence(name))
    .map((name) => name.replace(/\.mjs$/, ""))
    .filter((name) => name !== AGGREGATOR)
    .sort()
}

/** Law files in one axis. */
const laws = (axis) => {
  const dir = join(ROOT, axis, "canon", "patterns")
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => name.replace(/\.md$/, ""))
    .sort()
}

for (const axis of AXES) {
  test(`${axis}: every rule module has a law of the same name`, () => {
    const orphans = ruleModules(axis).filter((name) => !laws(axis).includes(name))
    assert.deepEqual(
      orphans,
      [],
      `sources/${axis}/ holds rules nothing documents: ${orphans.join(", ")}. A rule with no law is one an author meets in review with nothing to argue with - write ${axis}/canon/patterns/<name>.md, or delete the module.`,
    )
  })

  test(`${axis}: every rule module has a twin test`, () => {
    const untested = ruleModules(axis).filter(
      (name) => !existsSync(join(ROOT, "sources", axis, `${name}.test.mjs`)),
    )
    assert.deepEqual(
      untested,
      [],
      `sources/${axis}/ holds rules with no twin: ${untested.join(", ")}. A rule copied into another repository without its test goes quiet the first time somebody edits a pattern, and nothing turns red.`,
    )
  })

  test(`${axis}: every law names its artifact, and the artifact exists`, () => {
    const broken = []
    for (const name of laws(axis)) {
      const text = readFileSync(join(ROOT, axis, "canon", "patterns", `${name}.md`), "utf8")
      // Match the LINK, never the sentence around it. An early version of this gate required one
      // exact phrase and failed the one law careful enough to say that only HALF of it is
      // machine-checkable - a gate punishing canon for its prose, which is the gate being wrong.
      const links = [...text.matchAll(/\]\((\.{1,2}\/[^)]*sources\/[^)]+)\)/g)].map((hit) => hit[1])
      if (links.length === 0) {
        broken.push(`${name}: names no artifact`)
        continue
      }
      for (const link of links) {
        const target = join(ROOT, axis, "canon", "patterns", link)
        if (!existsSync(target)) broken.push(`${name}: points at ${link}, which is absent`)
      }
    }
    assert.deepEqual(
      broken,
      [],
      `laws in ${axis}/canon/patterns/ are lying about their enforcement: ${broken.join("; ")}. A law that reads as enforced while nothing holds it is worse than one that admits it is only a document.`,
    )
  })
}
