/**
 * Where an import specifier points. A `compilerOptions.paths` alias resolves through the program's own options, so a
 * rule asks the same question TypeScript asks instead of maintaining a second alias table.
 */
import { posix } from "node:path"
import { typed } from "./types.mjs"

/**
 * The absolute path an alias specifier maps to under the program's `compilerOptions.paths`, or null when no pattern matches.
 *
 * @param {object} context - The ESLint rule context.
 * @param {string} specifier - An import specifier.
 * @returns {{ target: string, rest: string } | null} The absolute target without extension and the part the wildcard matched.
 */
export const resolveAlias = (context, specifier) => {
    const options = typed(context).program.getCompilerOptions()
    const base = options.baseUrl ?? options.pathsBasePath
    if (!options.paths || typeof base !== "string") return null
    for (const [pattern, targets] of Object.entries(options.paths)) {
        if (!pattern.endsWith("/*") || !targets[0]) continue
        const prefix = pattern.slice(0, -1)
        if (!specifier.startsWith(prefix)) continue
        const rest = specifier.slice(prefix.length)
        return { target: posix.normalize(`${base.replace(/\\/g, "/")}/${targets[0].replace("*", rest)}`), rest }
    }
    return null
}
