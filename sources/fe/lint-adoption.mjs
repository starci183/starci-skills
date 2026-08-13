/**
 * Repository-level audit for effective StarCi FE lint adoption.
 *
 * An ESLint config can import a plugin, copy a plugin, or call itself StarCi while still leaving
 * canonical rules switched off. The only useful evidence is the effective config ESLint applies
 * to a real production file. This audit compares that printed config with this canon.
 */
/**
 * Where the component tree sits, per supported repository shape.
 *
 * ONE BRANCH, IN ONE PLACE. The difference between a monorepo and a single app is not a difference
 * of law - the rules, their severities and the inline-config refusal are identical. It is only
 * WHERE the law applies. Written out in each repository's config, that fact became two hand-kept
 * lists, and the lists did what hand-kept lists do: one enabled 43 rules, the other 53, and canon
 * had 49. Neither repository was wrong on purpose; nothing told either of them.
 *
 * The candidate path is included deliberately. A Preview candidate is the exact source Apply later
 * ports into production, and leaving it ungoverned means the one file that becomes production was
 * judged by nothing.
 */
const LAYOUT_GLOBS = {
    monorepo: [
        "packages/ui/src/**/*.{ts,tsx}",
        "apps/*/src/**/*.{ts,tsx}",
        "**/candidate/src/**/*.{ts,tsx}",
    ],
    "single-app": [
        "src/**/*.{ts,tsx}",
        "**/candidate/src/**/*.{ts,tsx}",
    ],
}

/** The repository shapes this canon knows how to govern. */
export const LAYOUTS = Object.keys(LAYOUT_GLOBS)

/**
 * The one flat-config block that attaches this canon to a repository.
 *
 * A consuming `eslint.config.mjs` spreads the result and owns nothing else about the rules: not
 * which are on, not their severity, not whether an inline comment may switch one off. Its own
 * plugins, its own ignores and its own language options stay its own business - what it may not
 * keep is a second opinion about the law.
 *
 * @param {object} input - Attachment options.
 * @param {"monorepo" | "single-app"} input.layout - Which shape this repository has.
 * @param {object} input.plugin - The plugin object, imported from this canon.
 * @param {object} input.recommended - The recommendation, imported from this canon.
 * @param {object} input.linterOptions - The linter options, imported from this canon.
 * @returns {object} One flat-config block.
 */
export const starciFeConfig = ({ layout, plugin, recommended, linterOptions }) => {
    const files = LAYOUT_GLOBS[layout]
    if (!files) {
        throw new Error(`unknown layout "${layout}" - expected one of: ${LAYOUTS.join(", ")}`)
    }
    /*
     * `recommended` is a FLAT rule map here, not a config object with a `rules` key - and reaching
     * for `.rules` on it is the mistake this line exists to stop repeating. Spread that way it
     * yields `undefined`, the block ends up with zero rules, and the repository lints clean while
     * being governed by nothing. That is the worst possible failure for this file: green, silent,
     * and indistinguishable from success. Both spellings are accepted so neither shape can produce
     * an empty block.
     */
    const rules = recommended?.rules ?? recommended
    if (!rules || Object.keys(rules).length === 0) {
        throw new Error("starciFeConfig received an empty recommendation - a config with no rules is not adoption")
    }
    return {
        files,
        linterOptions,
        plugins: { "starci-fe": plugin },
        rules: { ...rules },
    }
}

/** Convert every flat-config severity spelling to its numeric meaning. */
const severityOf = (setting) => {
  const severity = Array.isArray(setting) ? setting[0] : setting
  if (severity === "error") return 2
  if (severity === "warn") return 1
  if (severity === "off") return 0
  return severity
}

/**
 * Compare an `eslint --print-config` result with the canonical recommendation.
 *
 * @param {object} printedConfig - Parsed effective ESLint config for one production probe file.
 * @param {Record<string, string | number | unknown[]>} expectedRules - Canonical rule levels.
 */
export const auditLintAdoption = (printedConfig, expectedRules) => {
  const actualRules = printedConfig?.rules ?? {}
  const missing = []
  const nonError = []

  for (const name of Object.keys(expectedRules).sort()) {
    if (actualRules[name] === undefined) {
      missing.push(name)
      continue
    }
    if (severityOf(actualRules[name]) !== 2) nonError.push(name)
  }

  const refusesInlineConfig = printedConfig?.linterOptions?.noInlineConfig === true
  return {
    ok: missing.length === 0 && nonError.length === 0 && refusesInlineConfig,
    missing,
    nonError,
    refusesInlineConfig,
  }
}

/** Repository audits are gathered beside rules, but are not ESLint AST rules themselves. */
export const audits = { "effective-config": auditLintAdoption }
export const rules = {}
export const recommended = {}
