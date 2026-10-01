import { existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Registers the repository path aliases (`@modules/*`, `@features/*`, `@tests/*`) for the code the globalSetup loads in the jest
 * parent process (jest's moduleNameMapper does not apply there). Reads `src/tests/tsconfig.json` when present, else
 * `tsconfig.json`. A repository without `tsconfig-paths` installed gets a clear failure at the first alias import instead.
 */
export const registerTsPaths = (root: string): void => {
    const project = existsSync(join(root, "src", "tests", "tsconfig.json")) ? join(root, "src", "tests") : root
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const tsconfigPaths = require("tsconfig-paths") as typeof import("tsconfig-paths")
        const loaded = tsconfigPaths.loadConfig(project)
        if (loaded.resultType === "success") tsconfigPaths.register({ baseUrl: loaded.absoluteBaseUrl, paths: loaded.paths })
    } catch {
        // tsconfig-paths is a peer dependency; a repository with no aliases does not need it
    }
}
