// The patterns of check-work-surfaces.mjs that read routes and graphql operations out of source and prose. Each is
// assembled from named parts, so a part reads on its own and the whole stays one pattern.
const WORD_BOUNDARY = String.raw`\b`;
const SPACE_RUN = String.raw`\s+`;
const IDENTIFIER = String.raw`([a-zA-Z_]\w*)`;
const GQL_KIND = '(query|mutation)';
const CAMEL_NAME = String.raw`([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)`;
const GQL_WORD = 'GraphQL';

const pattern = (parts, flags = 'g') => new RegExp(parts.join(''), flags);

/** `@Get('x')`, `@Post('x', {httpCode})` and the other method decorators with a path argument. */
export const HTTP_DECORATOR_WITH_OPTIONS = pattern(['@(Get|Post|Put|Patch|Delete|Head|Options|All)', String.raw`\(\s*`, `['"]`, `([^'"]*)`, `['"]?`, String.raw`\s*[,)]`]);

/** `GET /path` written in contract prose. */
export const HTTP_DECL_RE = pattern([WORD_BOUNDARY, '(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|ALL)', SPACE_RUN, String.raw`(\/[^\s,;'")\]}]+)`]);

// strict patterns: the op name's position is unambiguous, so a miss is a ghost.
export const GQL_STRICT_RES = [
  pattern([WORD_BOUNDARY, IDENTIFIER, String.raw`\s*\([^)]*\)`, SPACE_RUN, GQL_WORD, SPACE_RUN, GQL_KIND, WORD_BOUNDARY]),   // "the account(personId) GraphQL query"
  pattern([WORD_BOUNDARY, IDENTIFIER, SPACE_RUN, GQL_WORD, SPACE_RUN, GQL_KIND, WORD_BOUNDARY]),                              // "the taskCounts GraphQL query"
  pattern([WORD_BOUNDARY, GQL_WORD, SPACE_RUN, IDENTIFIER, SPACE_RUN, GQL_KIND, WORD_BOUNDARY]),                              // "the GraphQL taskCounts query"
];

/** "mutation addCartItem" (camelCase only - prose words stay lowercase). */
export const GQL_KIND_THEN_CAMEL = pattern([WORD_BOUNDARY, GQL_KIND, SPACE_RUN, CAMEL_NAME, WORD_BOUNDARY]);
/** "addCartItem mutation". */
export const GQL_CAMEL_THEN_KIND = pattern([WORD_BOUNDARY, CAMEL_NAME, SPACE_RUN, GQL_KIND, WORD_BOUNDARY]);

// Loose patterns ("GraphQL query composes ..." would yield 'composes') only ever make a served op claimed.
export const GQL_LOOSE_RES = [
  pattern([WORD_BOUNDARY, GQL_WORD, SPACE_RUN, GQL_KIND, SPACE_RUN, IDENTIFIER]),   // "the GraphQL query taskCounts"
  GQL_KIND_THEN_CAMEL,
];
