/**
 * The one flat config of a StarCi front end.
 *
 * A repository's `eslint.config.mjs` is a managed file (R05/R16/R17), rendered by `starci app sync` as exactly:
 *
 *     import { loadHfs, starciFeConfig } from "@starci/eslint-canon-fe"
 *     export default starciFeConfig({ hfs: loadHfs(import.meta.url) })
 *
 * The factory owns everything else: which files are linted (the source of every app and every workspace package), typed linting on the source (`parserOptions.projectService`, so a rule asks what a node IS rather than what
 * it is called), the ignores, the linter options that make a disable comment impossible, every canon rule at `error`,
 * the React Hooks rules at `error`, and `settings.starci.hfs` - the slot view each path-scoped rule asks instead of a path
 * pattern. It takes no rule overrides, globs or ignores: there is no parameter through which a repository could weaken
 * the canon.
 */
import tsParser from "@typescript-eslint/parser"
import { OUTSIDE_THE_SCAN_FILES } from "../runtime/scripts/lib/sonar-syntax-rules.mjs"
import { sonarWayRules } from "../runtime/scripts/lib/sonar-way.mjs"

/** A disable directive is a weakening of lint, and one that suppresses nothing is dead weight. */
export const linterOptions = Object.freeze({ noInlineConfig: true, reportUnusedDisableDirectives: "error" })

/** The product source of a front end: every app's `src/` and every workspace package's `src/` (slots fe.* and repo.packages). */
export const SOURCE_FILES = Object.freeze(["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"])

/** Build output, installed packages, generated wire types and the harness's report directory are never linted. */
export const IGNORED = Object.freeze(["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "**/__generated__/**", ".starci/**"])

/**
 * The type-aware typescript-eslint rules the canon borrows, all `error` and the same set the back-end canon borrows for the type-aware laws: a promise is awaited or
 * handled (`no-floating-promises`, `no-misused-promises`), a `switch` over a union names every member, nothing flows out of an `any` (the `no-unsafe-*` family),
 * and the Sonar rules that need the checker: S1874 (a deprecated API), S6551 (an object turned into text) and S7503 (an `async` function that never awaits).
 */
export const BORROWED = Object.freeze({
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error",
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-deprecated": "error",
  "@typescript-eslint/no-base-to-string": "error",
  "@typescript-eslint/require-await": "error",
})

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

/**
 * The flat config of one front-end repository.
 *
 * @param {object} input - Attachment options.
 * @param {object} input.hfs - The HFS view of the repository (`loadHfs(import.meta.url)`).
 * @param {object} input.plugin - The canon plugin.
 * @param {Record<string, unknown>} input.source - The source-tree levels (canon rules plus the React Hooks rules).
 * @param {object} input.reactHooks - The React Hooks plugin.
 * @param {object} input.tsPlugin - The typescript-eslint plugin.
 * @param {{ sonarjs: object, unicorn: object }} input.sonar - The plugins of the Sonar way rules (scripts/lib/sonar-way.mjs).
 * @returns {Array<object>} The flat config: one ignore block, one typed source block and the Sonar way block.
 */
export const buildFeConfig = ({ hfs, plugin, source, reactHooks, tsPlugin, sonar }) => {
  if (!hfs || typeof hfs.slotOf !== "function" || typeof hfs.repoRoot !== "string") {
    throw new Error("starciFeConfig needs { hfs: loadHfs(import.meta.url) } - the rules read the repository's slots through it")
  }
  if (hfs.profile !== "fe") throw new Error(`starciFeConfig lints the fe side of an app (its eslint.config.mjs lives in fe/); this view is ${hfs.side ? `the ${hfs.side} side` : "the app root"}`)
  if (Object.keys(source).length === 0) throw new Error("starciFeConfig received an empty source recommendation - a config with no rules is not adoption")
  const weak = Object.entries(source).filter(([, setting]) => levelOf(setting) !== "error").map(([name]) => name)
  if (weak.length > 0) throw new Error(`starciFeConfig refuses source rules not at error: ${weak.join(", ")}`)
  const settings = { starci: { hfs } }
  return [
    { ignores: [...IGNORED] },
    {
      files: [...SOURCE_FILES],
      languageOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: { projectService: true, tsconfigRootDir: hfs.repoRoot, ecmaFeatures: { jsx: true } },
      },
      linterOptions: { ...linterOptions },
      plugins: { "starci-fe": plugin, "react-hooks": reactHooks, "@typescript-eslint": tsPlugin },
      settings,
      rules: { ...source, ...BORROWED },
    },
    // Sonar way: what the scan raises is refused while the code is written; a spec is outside the scan, so outside this block.
    { files: [...SOURCE_FILES], ignores: [...OUTSIDE_THE_SCAN_FILES], plugins: { sonarjs: sonar.sonarjs, unicorn: sonar.unicorn }, rules: sonarWayRules(sonar.sonarjs, "fe").rules },
  ]
}

/**
 * The canon rules that need no slot view: they judge a node and its types, never where the file sits in an app. A tree that is no HFS front end (a
 * runtime package, the harness UI) is linted by exactly these plus the type-aware, React Hooks and Sonar way rules. The set is closed by
 * config.spec.mjs: every other rule of the plugin refuses to run without `settings.starci.hfs`, so a rule added to the plugin is either listed here
 * or proven slot-bound there.
 */
export const SLOT_FREE_RULES = Object.freeze([
  "client-no-server-import", "no-server-action", "no-dangerous-html", "response-cookie-attributes", "require-export-jsdoc", "no-vietnamese-in-source",
  "no-hardcoded-endpoint-fallback", "no-runtime-namespace", "list-item-has-key", "no-index-key", "no-inline-literal-prop-in-list", "prefer-arrow-export",
  "handler-on-prefix", "no-native-form-control", "no-native-img", "image-has-size", "no-second-i18n-stack", "html-lang-from-locale", "no-null-suspense-fallback",
  "no-native-anchor", "no-inline-parameter-type", "no-hand-rolled-polling", "status-text-uses-soft-foreground", "no-copy-in-call", "no-alert", "no-failure-collapse",
  "outcome-kinds-exhaustive", "no-await-in-loop", "prefer-code-point", "prefer-string-raw", "no-nested-conditional", "no-void-operator", "no-unused-import",
  "prefer-export-from", "no-unused-prop-types", "media-has-caption", "max-params",
])

/** The source of a plain front-end tree: its `src/`. */
export const PLAIN_SOURCE_FILES = Object.freeze(["src/**/*.{ts,tsx}"])

/**
 * The flat config of a TypeScript front-end tree that is no HFS app: the same fences as an app (typed linting, no inline directive, every rule at
 * `error`) over the rules that need no slot view. It takes the root of the tree and nothing else.
 *
 * @param {object} input - Attachment options.
 * @param {string} input.root - The absolute directory holding the tree's `tsconfig.json` and `src/`.
 * @param {object} input.plugin - The canon plugin.
 * @param {Record<string, unknown>} input.hooks - The React Hooks rules at error.
 * @param {object} input.reactHooks - The React Hooks plugin.
 * @param {object} input.tsPlugin - The typescript-eslint plugin.
 * @param {{ sonarjs: object, unicorn: object }} input.sonar - The plugins of the Sonar way rules.
 * @returns {Array<object>} The flat config: one ignore block, one typed source block and the Sonar way block.
 */
export const buildPlainSourceConfig = ({ root, plugin, hooks, reactHooks, tsPlugin, sonar, canon = true }) => {
  if (typeof root !== "string" || root === "") throw new Error("starciPlainSourceConfig needs { root } - the directory of the tree's tsconfig.json and src/")
  const canonRules = canon ? Object.fromEntries(SLOT_FREE_RULES.map((name) => [`starci-fe/${name}`, "error"])) : {}
  const missing = SLOT_FREE_RULES.filter((name) => !(name in plugin.rules))
  if (missing.length > 0) throw new Error(`starciPlainSourceConfig lists rules the canon plugin does not publish: ${missing.join(", ")}`)
  return [
    { ignores: [...IGNORED] },
    {
      files: [...PLAIN_SOURCE_FILES],
      languageOptions: {
        parser: tsParser,
        ecmaVersion: "latest",
        sourceType: "module",
        parserOptions: { projectService: true, tsconfigRootDir: root, ecmaFeatures: { jsx: true } },
      },
      linterOptions: { ...linterOptions },
      plugins: { "starci-fe": plugin, "react-hooks": reactHooks, "@typescript-eslint": tsPlugin },
      rules: { ...canonRules, ...hooks, ...BORROWED },
    },
    { files: [...PLAIN_SOURCE_FILES], ignores: [...OUTSIDE_THE_SCAN_FILES], plugins: { sonarjs: sonar.sonarjs, unicorn: sonar.unicorn }, rules: sonarWayRules(sonar.sonarjs, "fe").rules },
  ]
}
