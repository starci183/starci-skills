/**
 * The one flat config of a StarCi back end.
 *
 * A repository's `eslint.config.mjs` is a managed file (R05/R16), rendered by `starci app sync` as exactly:
 *
 *     import { loadHfs, starciBeConfig } from "@starci/eslint-canon-be"
 *     export default starciBeConfig({ hfs: loadHfs(import.meta.url) })
 *
 * The factory owns everything else: typed linting on every tracked TypeScript and JavaScript file
 * (`parserOptions.projectService`), the ignores (`dist/`, `coverage/`, `node_modules/` and nothing more), the
 * linter options that make a disable comment impossible, the borrowed typescript-eslint rules, every canon rule at
 * `error`, and `settings.starci.hfs` - the slot view each path-scoped rule asks instead of a path pattern.
 *
 * NO RULE IS OFF OR WARN. The recommendation itself ships `error`; the factory refuses one that carries anything
 * else, so a rule cannot be published weakened and still look adopted. The factory takes no rule overrides, globs
 * or ignores: there is no parameter through which a repository could weaken the canon.
 */
import tsParser from "@typescript-eslint/parser"

/** A disable directive is a weakening of lint, and one that suppresses nothing is dead weight. */
export const linterOptions = Object.freeze({ noInlineConfig: true, reportUnusedDisableDirectives: "error" })

/** Every tracked source a back end holds; the factory lints them all. */
export const SOURCE_FILES = Object.freeze(["**/*.ts", "**/*.mts", "**/*.cts", "**/*.js", "**/*.mjs", "**/*.cjs"])

/** The only paths a back end never lints: build output, coverage output and installed packages. */
export const IGNORED = Object.freeze(["dist/**", "coverage/**", "**/node_modules/**"])

/**
 * Root-level JavaScript (the managed `eslint.config.mjs`, `jest.config.js`) is outside `tsconfig.json`
 * (`allowJs: false`); the project service types it with a default project instead of skipping it.
 */
const ROOT_SCRIPTS = Object.freeze(["*.js", "*.mjs", "*.cjs"])

/** The typescript-eslint rules the canon borrows (BE-CONVENTION 1.17, R72/R73; Sonar S1874, S6551 and S7503 through R235), all `error`. */
export const BORROWED = Object.freeze({
    "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/array-type": ["error", { default: "generic", readonly: "generic" }],
    "@typescript-eslint/no-deprecated": "error",
    "@typescript-eslint/no-base-to-string": "error",
    "@typescript-eslint/require-await": "error",
    "no-console": "error",
})

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

/**
 * The flat config of one back-end repository.
 *
 * @param {object} input - Attachment options.
 * @param {object} input.hfs - The HFS view of the repository (`loadHfs(import.meta.url)`).
 * @param {object} input.plugin - The canon plugin.
 * @param {Record<string, unknown>} input.recommended - The canon levels.
 * @returns {Promise<Array<object>>} The flat config (ESLint awaits an exported promise): one ignore block and one rule block.
 */
export const buildBeConfig = async ({ hfs, plugin, recommended }) => {
    if (!hfs || typeof hfs.slotOf !== "function" || typeof hfs.repoRoot !== "string") {
        throw new Error("starciBeConfig needs { hfs: loadHfs(import.meta.url) } - the rules read the repository's slots through it")
    }
    if (hfs.profile !== "be") throw new Error(`starciBeConfig lints the be side of an app (its eslint.config.mjs lives in be/); this view is ${hfs.side ? `the ${hfs.side} side` : "the app root"}`)
    const rules = recommended ?? {}
    if (!plugin?.rules) throw new Error("starciBeConfig needs the canon plugin")
    if (Object.keys(rules).length === 0) throw new Error("starciBeConfig received an empty recommendation - a config with no rules is not adoption")
    const weak = Object.entries(rules).filter(([, setting]) => levelOf(setting) !== "error").map(([name]) => name)
    if (weak.length > 0) throw new Error(`starciBeConfig refuses a recommendation with rules not at error: ${weak.join(", ")}`)
    // Loaded here, not at import: the rule catalog check imports this package to list its rules and needs no linter plugin.
    const { default: tsPlugin } = await import("@typescript-eslint/eslint-plugin")
    return [
        { ignores: [...IGNORED] },
        {
            files: [...SOURCE_FILES],
            languageOptions: {
                parser: tsParser,
                ecmaVersion: "latest",
                sourceType: "module",
                parserOptions: { projectService: { allowDefaultProject: [...ROOT_SCRIPTS] }, tsconfigRootDir: hfs.repoRoot },
            },
            linterOptions: { ...linterOptions },
            plugins: { "starci-be": plugin, "@typescript-eslint": tsPlugin },
            settings: { starci: { hfs } },
            rules: { ...rules, ...BORROWED },
        },
    ]
}
