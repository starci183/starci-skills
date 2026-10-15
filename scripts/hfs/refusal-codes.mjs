// Infrastructure refusals are shared with the dependency-free runtime copy generator.
// They describe checks that could not run, rather than catalogued obligations.
export const REFUSAL_CODES = Object.freeze([
  'HFS_REPO_UNREADABLE',
  'HFS_DECLARATION_INVALID', 'HFS_MANIFEST_MAJOR_MISMATCH', 'HFS_MANIFEST_INVALID', 'HFS_FORMAT_TOOL_MISSING', 'HFS_EDITION_INVALID',
]);
