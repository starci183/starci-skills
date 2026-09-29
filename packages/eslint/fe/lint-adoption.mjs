/**
 * Repository-level audit for effective StarCi FE lint adoption.
 *
 * An ESLint config can import a plugin, copy a plugin, or call itself StarCi while still leaving
 * canonical rules switched off. The only useful evidence is the effective config ESLint applies
 * to a real production file. This audit compares that printed config with this canon: pass `sourceRecommended`
 * for a production probe file and `e2eRecommended` for an e2e probe, since each tree has its own rules.
 */
/**
 * Where each tree sits, per supported repository shape.
 *
 * ONE BRANCH, IN ONE PLACE. The difference between a monorepo and a single app is not a difference
 * of law - the rules, their severities and the inline-config refusal are identical. It is only
 * WHERE the law applies. Written out in each repository's config, that fact became two hand-kept
 * lists, and the lists did what hand-kept lists do: one enabled 43 rules, the other 53, and canon
 * had 49. Neither repository was wrong on purpose; nothing told either of them.
 *
 * TWO TREES. `src` is the product source, governed by every law except the e2e one; `e2e` is the
 * Playwright tree and its config, governed by the e2e law and the escape-hatch fence.
 *
 * The candidate path is included deliberately. A Preview candidate is the exact source Apply later
 * ports into production, and leaving it ungoverned means the one file that becomes production was
 * judged by nothing.
 */
export const LAYOUT_GLOBS = {
    monorepo: {
        src: ["packages/ui/src/**/*.{ts,tsx}", "apps/*/src/**/*.{ts,tsx}", "**/candidate/src/**/*.{ts,tsx}"],
        e2e: ["e2e/**/*.{ts,tsx}", "apps/*/e2e/**/*.{ts,tsx}", "playwright.config.{ts,mts}", "apps/*/playwright.config.{ts,mts}"],
    },
    "single-app": {
        src: ["src/**/*.{ts,tsx}", "**/candidate/src/**/*.{ts,tsx}"],
        e2e: ["e2e/**/*.{ts,tsx}", "playwright.config.{ts,mts}"],
    },
}

/** The repository shapes this canon knows how to govern. */
export const LAYOUTS = Object.keys(LAYOUT_GLOBS)

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
