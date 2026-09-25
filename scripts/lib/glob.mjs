// glob.mjs — the path-glob subset ESLint, SonarQube and the scoped-lint config share: `**` spans directories,
// `*` and `?` stay inside one segment, `{a,b}` alternates.
import { posixPath } from './path-key.mjs';

/** Every alternative a `{a,b}` pattern spells, braces expanded left to right. */
export function braceVariants(value) {
  const match = /\{([^{}]+)\}/.exec(value);
  return match ? match[1].split(',').flatMap((part) => braceVariants(`${value.slice(0, match.index)}${part}${value.slice(match.index + match[0].length)}`)) : [value];
}

/** The anchored RegExp of one brace-free glob, read as a posix path (backslashes and a leading './' folded). */
export function globExpression(value) {
  const input = posixPath(value);
  let source = '';
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (c === '*' && input[i + 1] === '*') { i += 1; if (input[i + 1] === '/') { i += 1; source += '(?:.*/)?'; } else source += '.*'; }
    else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return new RegExp(`^${source}$`);
}
