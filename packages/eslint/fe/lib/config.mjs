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

/** A disable directive is a weakening of lint, and one that suppresses nothing is dead weight. */
export const linterOptions = Object.freeze({ noInlineConfig: true, reportUnusedDisableDirectives: "error" })

/** The product source of a front end: every app's `src/` and every workspace package's `src/` (slots fe.* and repo.packages). */
export const SOURCE_FILES = Object.freeze(["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"])

/** Build output, installed packages, generated wire types and the harness's report directory are never linted. */
export const IGNORED = Object.freeze(["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**", "**/__generated__/**", ".starci/**"])

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

/**
 * The flat config of one front-end repository.
 *
 * @param {object} input - Attachment options.
 * @param {object} input.hfs - The HFS view of the repository (`loadHfs(import.meta.url)`).
 * @param {object} input.plugin - The canon plugin.
 * @param {Record<string, unknown>} input.source - The source-tree levels (canon rules plus the React Hooks rules).
 * @param {object} input.reactHooks - The React Hooks plugin.
 * @returns {Array<object>} The flat config: one ignore block and one typed source block.
 */
export const buildFeConfig = ({ hfs, plugin, source, reactHooks }) => {
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
      plugins: { "starci-fe": plugin, "react-hooks": reactHooks },
      settings,
      rules: { ...source },
    },
  ]
}
