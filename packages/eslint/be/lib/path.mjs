/** Forward-slash form of a filename, so Windows paths compare like every other path. */
export const normalizePath = (filename) => String(filename || "").replaceAll("\\", "/")

/** A spec file: the unit lane, where a fixture may build a deliberately wrong value. */
export const isSpecFile = (filename) => /\.(?:spec|test)\.[cm]?[jt]sx?$|-spec\.[cm]?[jt]sx?$/.test(normalizePath(filename))

/** A migration: the one place schema-changing SQL is allowed to be written. */
export const isMigrationFile = (filename) => /\/persistence\/migrations\/[^/]+\.[cm]?[jt]s$/.test(normalizePath(filename))

/** A declaration file carries types only and no runtime behaviour to police. */
export const isDeclarationFile = (filename) => /\.d\.[cm]?ts$/.test(normalizePath(filename))
