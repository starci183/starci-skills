/** Forward-slash form of a filename, so Windows paths compare like every other path. */
export const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** A spec file: the unit lane, where a fixture may build a deliberately wrong value. */
export const isSpecFile = (filename) => /\.(?:spec|test)\.[cm]?[jt]sx?$|-spec\.[cm]?[jt]sx?$/.test(normalizePath(filename))

/** Any file of the test lanes: a spec, or anything under `src/tests/`. */
export const isTestLane = (filename) => {
    const file = normalizePath(filename)
    return isSpecFile(file) || file.includes("/src/tests/")
}

/** A migration: the one place schema-changing SQL is allowed to be written. */
export const isMigrationFile = (filename) => /\/persistence\/migrations\/[^/]+\.[cm]?[jt]s$/.test(normalizePath(filename))

/** A declaration file carries types only and no runtime behaviour to police. */
export const isDeclarationFile = (filename) => /\.d\.[cm]?ts$/.test(normalizePath(filename))
