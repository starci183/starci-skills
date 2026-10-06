/** Forward-slash form of a filename, so Windows paths compare like every other path. */
export const normalizePath = (filename) => String(filename || "").replaceAll("\\", "/")
