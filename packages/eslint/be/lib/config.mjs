/**
 * The one flat-config block that attaches the back-end canon to a repository.
 *
 * A consuming `eslint.config.mjs` used to hand-copy three things: the list of retired rules it
 * switches off, the helper that lifts `warn` to `error`, and the source globs. Copies drift - two
 * repositories held byte-identical files, a third had grown its own variant - and a rule that a copy
 * switched off with the words "replaced by checks" was enforced by nothing when the replacing check
 * ran in no gate. This factory owns the first two, so a repository states only its source globs.
 *
 * RETIRED rules are the legacy heuristics the code-pattern manifest keeps off on purpose
 * (`modules/models/code-patterns.yaml`, the `expected: { severity: off }` guards). Each names the
 * obligation that replaces it. They are off here and nowhere else: a repository cannot add to or
 * drop from this list, because the list is the canon's opinion, not the repository's.
 */

/** Retired rule -> the obligation whose check replaces it. `null` means test selection is a review, not a rule. */
export const RETIRED = Object.freeze({
    "starci-be/exception-name-ends-in-exception": "NEST-EXCEPTION-IDENTITY",
    "starci-be/exception-code-matches-class-name": "NEST-EXCEPTION-IDENTITY",
    "starci-be/exception-metadata-type-named-for-class": "NEST-EXCEPTION-IDENTITY",
    "starci-be/exception-extends-abstract": "NEST-EXCEPTION-IDENTITY",
    "starci-be/exception-in-errors-folder": "NEST-EXCEPTION-IDENTITY",
    "starci-be/require-exception-object-arg": "NEST-EXCEPTION-IDENTITY",
    "starci-be/throw-abstract-exception": "NEST-EXCEPTION-IDENTITY",
    "starci-be/no-handler-encoded-failure": "NEST-EXCEPTION-IDENTITY",
    "starci-be/must-deep-module-import": "NEST-OWNER-PUBLIC-ENTRY",
    "starci-be/no-folder-reexport": "NEST-OWNER-PUBLIC-ENTRY",
    "starci-be/handler-has-twin-spec": null,
})

/** A disable directive is a weakening of lint, and one that suppresses nothing is dead weight. */
export const linterOptions = Object.freeze({ noInlineConfig: true, reportUnusedDisableDirectives: "error" })

/** The zero-warning gate reads a warning as a failure, so the canon's `warn` level is stated as `error`. */
const asError = (setting) =>
    setting === "warn" ? "error" : Array.isArray(setting) && setting[0] === "warn" ? ["error", ...setting.slice(1)] : setting

/**
 * @param {object} input - Attachment options.
 * @param {string[]} input.sources - The globs of the repository's production and spec source.
 * @param {object} input.plugin - The plugin object, imported from this canon.
 * @param {Record<string, unknown>} input.recommended - The recommendation, imported from this canon.
 * @returns {object} One flat-config block.
 */
export const starciBeConfig = ({ sources, plugin, recommended }) => {
    if (!Array.isArray(sources) || sources.length === 0) {
        throw new Error("starciBeConfig needs the repository's source globs - a block that matches no file governs nothing")
    }
    const rules = recommended?.rules ?? recommended
    if (!rules || Object.keys(rules).length === 0) {
        throw new Error("starciBeConfig received an empty recommendation - a config with no rules is not adoption")
    }
    const unknown = Object.keys(RETIRED).filter((name) => !(name in rules))
    if (unknown.length > 0) {
        throw new Error(`starciBeConfig retires rules the recommendation does not carry: ${unknown.join(", ")}`)
    }
    const configured = Object.fromEntries(
        Object.entries(rules).map(([name, setting]) => [name, name in RETIRED ? "off" : asError(setting)]),
    )
    return { files: sources, linterOptions: { ...linterOptions }, plugins: { "starci-be": plugin }, rules: configured }
}
