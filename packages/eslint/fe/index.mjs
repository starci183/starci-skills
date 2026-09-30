/**
 * The front-end plugin: every law's rules, gathered once.
 *
 * A consuming repository imports THIS and nothing below it. Registering rules one by one in the
 * target's own plugin file is how the two lists drift: a law gains a rule here, nobody adds it
 * there, and the rule ships as a document. `starciFeConfig` therefore owns BOTH questions - what
 * exists and what is switched on - and every rule is an error: the repository's `eslint.config.mjs`
 * names its layout and nothing else about the law.
 *
 * WHAT THIS FILE REFUSES TO DO. It does not rename anything. A rule's published name is part of the
 * law that declares it, because that name is what appears in a build log, in a disable comment and
 * in every conversation about the failure. Aliasing one here to match a target's older spelling
 * would leave two names for one rule and no way to tell which a message came from.
 */
import { createRequire } from "node:module"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { recommended as brandValuesRecommended, rules as brandValuesRules } from "./brand-values.mjs"
import { recommended as clientBoundaryRecommended, rules as clientBoundaryRules } from "./client-boundary.mjs"
import { recommended as commentsRecommended, rules as commentsRules } from "./comments.mjs"
import { recommended as classNamesRecommended, rules as classNamesRules } from "./class-names.mjs"
import { recommended as envOwnerRecommended, rules as envOwnerRules } from "./env-owner.mjs"
import { recommended as fileLayoutRecommended, rules as fileLayoutRules } from "./file-layout.mjs"
import { recommended as grammarBoundaryRecommended, rules as grammarBoundaryRules } from "./grammar-boundary.mjs"
import { recommended as formattingRecommended, rules as formattingRules } from "./formatting.mjs"
import { recommended as hooksFolderRecommended, rules as hooksFolderRules } from "./hooks-folder.mjs"
import { recommended as hygieneRecommended, rules as hygieneRules } from "./hygiene.mjs"
import { recommended as iconRecommended, rules as iconRules } from "./icon.mjs"
import { recommended as landmarkRecommended, rules as landmarkRules } from "./landmark.mjs"
import { recommended as listsRecommended, rules as listsRules } from "./lists.mjs"
import { recommended as loadingRecommended, rules as loadingRules } from "./loading.mjs"
import { recommended as lintEscapeRecommended, rules as lintEscapeRules } from "./lint-escape-hatch.mjs"
import { recommended as namingRecommended, rules as namingRules } from "./naming.mjs"
import { recommended as nativeControlsRecommended, rules as nativeControlsRules } from "./native-controls.mjs"
import { recommended as nextConventionsRecommended, rules as nextConventionsRules } from "./next-conventions.mjs"
import { recommended as propsRecommended, rules as propsRules } from "./props-and-slots.mjs"
import { recommended as servedLocaleRecommended, rules as servedLocaleRules } from "./served-locale.mjs"
import { recommended as shapeSlotRecommended, rules as shapeSlotRules } from "./shape-slot.mjs"
import { recommended as sizeBudgetRecommended, rules as sizeBudgetRules } from "./size-and-state-budget.mjs"
import { recommended as sizeGrowthRecommended, rules as sizeGrowthRules } from "./size-growth.mjs"
import { recommended as statusColorsRecommended, rules as statusColorsRules } from "./status-colors.mjs"
import { recommended as splitRecommended, rules as splitRules } from "./the-split.mjs"
import { recommended as tokensRecommended, rules as tokensRules } from "./tokens.mjs"
import { recommended as transportRecommended, rules as transportRules } from "./transport.mjs"
import { recommended as translationRecommended, rules as translationRules } from "./translation.mjs"
import { recommended as typeSafetyRecommended, rules as typeSafetyRules } from "./type-safety.mjs"
import { recommended as typographyRecommended, rules as typographyRules } from "./typography.mjs"
import { recommended as vendorRecommended, rules as vendorRules } from "./vendor-boundary.mjs"
import { recommended as projectGraphRecommended, rules as projectGraphRules } from "./project-graph.mjs"
import { buildFeConfig } from "./lib/config.mjs"
import { why } from "./lib/why.mjs"

/** Each law's contribution, kept separate so a duplicate name is detectable rather than silent. */
const CONTRIBUTIONS = [
    { law: "project-graph", rules: projectGraphRules, recommended: projectGraphRecommended },
  { law: "brand-values", rules: brandValuesRules, recommended: brandValuesRecommended },
  { law: "client-boundary", rules: clientBoundaryRules, recommended: clientBoundaryRecommended },
  { law: "comments", rules: commentsRules, recommended: commentsRecommended },
  {
    law: "class-names",
    rules: classNamesRules,
    recommended: classNamesRecommended,
  },
  { law: "env-owner", rules: envOwnerRules, recommended: envOwnerRecommended },
  { law: "file-layout", rules: fileLayoutRules, recommended: fileLayoutRecommended },
  { law: "grammar-boundary", rules: grammarBoundaryRules, recommended: grammarBoundaryRecommended },
  { law: "formatting", rules: formattingRules, recommended: formattingRecommended },
  { law: "hooks-folder", rules: hooksFolderRules, recommended: hooksFolderRecommended },
  { law: "hygiene", rules: hygieneRules, recommended: hygieneRecommended },
  { law: "icon", rules: iconRules, recommended: iconRecommended },
  { law: "landmark", rules: landmarkRules, recommended: landmarkRecommended },
  { law: "lists", rules: listsRules, recommended: listsRecommended },
  { law: "loading", rules: loadingRules, recommended: loadingRecommended },
  { law: "lint-escape-hatch", rules: lintEscapeRules, recommended: lintEscapeRecommended },
  { law: "naming", rules: namingRules, recommended: namingRecommended },
  { law: "native-controls", rules: nativeControlsRules, recommended: nativeControlsRecommended },
  { law: "next-conventions", rules: nextConventionsRules, recommended: nextConventionsRecommended },
  { law: "props-and-slots", rules: propsRules, recommended: propsRecommended },
  { law: "served-locale", rules: servedLocaleRules, recommended: servedLocaleRecommended },
  { law: "shape-slot", rules: shapeSlotRules, recommended: shapeSlotRecommended },
  { law: "size-and-state-budget", rules: sizeBudgetRules, recommended: sizeBudgetRecommended },
  { law: "size-growth", rules: sizeGrowthRules, recommended: sizeGrowthRecommended },
  { law: "status-colors", rules: statusColorsRules, recommended: statusColorsRecommended },
  { law: "the-split", rules: splitRules, recommended: splitRecommended },
  { law: "tokens", rules: tokensRules, recommended: tokensRecommended },
  { law: "translation", rules: translationRules, recommended: translationRecommended },
  { law: "transport", rules: transportRules, recommended: transportRecommended },
  { law: "type-safety", rules: typeSafetyRules, recommended: typeSafetyRecommended },
  { law: "typography", rules: typographyRules, recommended: typographyRecommended },
  { law: "vendor-boundary", rules: vendorRules, recommended: vendorRecommended },
]

/** Every gathered law. */
export const lawOwners = CONTRIBUTIONS.map((entry) => entry.law)

/**
 * Which law declares each rule.
 *
 * Exported because a failing rule is a question about a LAW, and the shortest path from a build log
 * to the document that explains it is this map. It is also what the twin test walks to prove no two
 * laws claim one name.
 */
export const ruleOwners = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.keys(entry.rules).map((name) => [name, entry.law])),
)

/**
 * Every (law, rule name) pair as DECLARED, before any collapsing.
 *
 * `ruleOwners` above and `rules` below are both built with `Object.fromEntries`, which silently
 * keeps the last writer when two laws declare one name. A guard that walks either of them cannot
 * see a collision - the duplicate is gone before it looks, so every name appears exactly once BY
 * CONSTRUCTION and the check passes forever while being blind.
 *
 * That is not hypothetical. The back-end twin had this exact shape, three rules were declared by two
 * laws each, one copy was discarded on import, and its guard reported green throughout. This axis
 * has no collision today; publishing the raw declarations is what keeps that a FACT rather than an
 * assumption nobody can test.
 */
export const ruleDeclarations = CONTRIBUTIONS.flatMap((entry) =>
  Object.keys(entry.rules).map((name) => ({ law: entry.law, name })),
)

/** Every rule this canon publishes, keyed by its published name. */
export const rules = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.rules)),
)

/**
 * The levels this canon asks for, as the plugin's own opinion.
 *
 * Every FE canon rule is an error. Existing debt is fixed before adoption; lowering architecture
 * to warn teaches every later author that the boundary is optional and is not a supported rollout.
 */
export const recommended = Object.fromEntries(
  CONTRIBUTIONS.flatMap((entry) => Object.entries(entry.recommended)),
)

/** Flat-config options that make inline directives ineffective rather than merely forbidden. */
export { linterOptions } from "./lib/config.mjs"
export { loadHfs } from "./lib/hfs.mjs"

/**
 * The Vietnamese why of each rule that carries a catalogue code: `{ code, vi, fixVi }`.
 *
 * Read by the harness, which quotes `vi` to the owner and files the finding under `code`.
 */
export { why }

/** The plugin object, shaped the way a flat config expects it. */
const plugin = {
  meta: { name: "eslint-plugin-starci-fe" },
  rules,
}

export default plugin

/**
 * The React Hooks plugin, from wherever the consuming repository installed it.
 *
 * A peer dependency is resolved from the package that asks for it, and a package linked by path
 * (`file:`) is resolved from its REAL location - which has no `node_modules` of the repository that
 * linked it. So the plugin is looked up from this package first and from the working directory
 * second; a repository that installed `eslint-plugin-react-hooks` beside its `eslint.config.mjs`
 * is found either way, and one that did not gets a message naming the install rather than a
 * resolver stack trace.
 */
const loadReactHooks = () => {
  for (const base of [import.meta.url, pathToFileURL(join(process.cwd(), "noop.js")).href]) {
    try {
      return createRequire(base)("eslint-plugin-react-hooks")
    } catch {
      // try the next place
    }
  }
  throw new Error("starciFeConfig needs eslint-plugin-react-hooks 7 or newer: npm i -D eslint-plugin-react-hooks")
}

/**
 * The React Hooks rules of a plugin, all at error.
 *
 * The plugin's own recommended set is the definition of "the hooks rules" - it carries the classic
 * pair and the compiler-derived ones (`set-state-in-effect`, `refs`, `purity`, `immutability`) - and
 * it ships several of them at `warn`. A warning is the level a team learns to scroll past, so the
 * canon states every one as `error`. Four rules are named on purpose: a plugin too old to carry them
 * would otherwise be adopted silently with the rules that catch effect-driven state and ref reads
 * during render missing.
 *
 * @param {object} reactHooks - The plugin object.
 * @returns {Record<string, "error">} Every recommended hooks rule at error.
 */
export const reactHooksRules = (reactHooks) => {
  const configured = reactHooks.configs?.flat?.recommended?.rules ?? {}
  for (const required of [
    "react-hooks/set-state-in-effect",
    "react-hooks/refs",
    "react-hooks/rules-of-hooks",
    "react-hooks/exhaustive-deps",
  ]) {
    if (!(required in configured)) {
      throw new Error(`eslint-plugin-react-hooks does not carry ${required}; install version 7 or newer`)
    }
  }
  return Object.fromEntries(Object.keys(configured).map((name) => [name, "error"]))
}

/**
 * The whole flat config of a front end: `export default starciFeConfig({ hfs: loadHfs(import.meta.url) })`.
 *
 * It owns nothing the repository could choose: which files are linted comes from the HFS profile (every app's and every
 * workspace package's `src/`), not which rules are on, not their level, not whether an inline comment may
 * switch one off. NO RULE IS OFF - the factory throws rather than emit a block in which a published rule is missing or
 * below error, so a rule added to this package reaches every repository or the build of this package fails.
 *
 * @param {{ hfs: object }} input - The HFS view of the repository (`loadHfs(import.meta.url)`).
 * @returns {object[]} The flat config: ignores and the typed source block.
 */
export const starciFeConfig = ({ hfs } = {}) => {
  const published = Object.keys(rules).map((name) => `starci-fe/${name}`)
  const notRequested = published.filter((name) => recommended[name] !== "error")
  if (notRequested.length > 0) {
    throw new Error(`starciFeConfig: these published rules are not requested at error: ${notRequested.join(", ")}`)
  }
  const reactHooks = loadReactHooks()
  return buildFeConfig({
    hfs,
    plugin,
    reactHooks,
    source: { ...recommended, ...reactHooksRules(reactHooks) },
  })
}
