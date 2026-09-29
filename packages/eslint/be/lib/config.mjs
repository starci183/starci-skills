/**
 * The one flat-config block that attaches the back-end canon to a repository.
 *
 * A consuming `eslint.config.mjs` used to hand-copy three things: the list of rules it switches off, the
 * helper that lifts `warn` to `error`, and the source globs. Copies drift - two repositories held
 * byte-identical files, a third had grown its own variant - and a rule that a copy switched off with the words
 * "replaced by checks" was enforced by nothing when the replacing check ran in no gate. This factory owns the
 * levels, so a repository states only its source globs.
 *
 * NO RULE IS OFF. HFS has no retired-rule list: a rule the standard no longer holds is deleted from the
 * plugin, and a rule that stays is on. The factory refuses a recommendation that carries an `off`, so a rule
 * cannot be published switched off and still look adopted.
 */

/** A disable directive is a weakening of lint, and one that suppresses nothing is dead weight. */
export const linterOptions = Object.freeze({ noInlineConfig: true, reportUnusedDisableDirectives: "error" })

/** The zero-warning gate reads a warning as a failure, so the canon's `warn` level is stated as `error`. */
const asError = (setting) =>
    setting === "warn" ? "error" : Array.isArray(setting) && setting[0] === "warn" ? ["error", ...setting.slice(1)] : setting

const levelOf = (setting) => (Array.isArray(setting) ? setting[0] : setting)

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
    const off = Object.entries(rules)
        .filter(([, setting]) => levelOf(setting) === "off")
        .map(([name]) => name)
    if (off.length > 0) {
        throw new Error(`starciBeConfig refuses a recommendation with rules switched off: ${off.join(", ")}`)
    }
    const configured = Object.fromEntries(
        Object.entries(rules).map(([name, setting]) => [name, asError(setting)]),
    )
    return { files: sources, linterOptions: { ...linterOptions }, plugins: { "starci-be": plugin }, rules: configured }
}
