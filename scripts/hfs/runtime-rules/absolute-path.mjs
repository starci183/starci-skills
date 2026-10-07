// absolute-path.mjs - RT_ABSOLUTE_PATH (knowledge/hfs/rules.yaml, gate runtime): no tracked file of the runtime holds a
// hard-coded absolute host path - a drive-letter path (a letter, a colon and a slash), a user-profile path (`/Users/<name>/`, `/home/<name>/`)
// or an expanded AppData path (the AppData folder's Local or Roaming part). The runtime repository uses relative paths: a path
// resolves from the runtime root, os.tmpdir(), the config or a state-root helper, and a spec builds every path and prompt
// fixture from its temp dir. `%LOCALAPPDATA%` as a name (not expanded) is not a path and is clean.
// Parse-aware: in .mjs/.cjs/.js/.ts/.tsx the rule reads the TypeScript syntax tree and judges only the VALUE of string and
// template literals and the text of comments - a regular-expression literal is not judged (a generic drive pattern
// names no host path), and neither is a URL (`http://`, `file://`: the colon is followed by a second
// slash). In yaml, json, md and the other text formats it reads the line text. Package lock files are not judged.
// The matcher itself is scripts/lib/host-path.mjs hostPathHits, shared with the settle refusal and the evidence normalizer.
// Pure apart from ctx.read.
import { hostPathHits } from '../../lib/host-path.mjs';
import { ts } from './source-ast.mjs';
import { lineOf } from '../../lib/check-scan.mjs';

export const CODE = 'RT_ABSOLUTE_PATH';
const SOURCE = /\.(?:mjs|cjs|js|mts|cts|ts|tsx|jsx)$/;
const LINE_TEXT = /\.(?:ya?ml|json|md|txt|sh|ps1|cmd|bat|html|css|toml)$/;
const SKIPPED = /(?:^|\/)(?:package-lock|npm-shrinkwrap)\.json$/;

const finding = (file, line, hit) => ({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} holds a hard-coded ${hit.kind} (${hit.sample}): the runtime repository uses relative paths - resolve from the runtime root, os.tmpdir(), the config or a state-root helper, and build spec fixtures from the temp dir` });

const scriptKindOf = (t, file) => {
  if (file.endsWith('.tsx')) return t.ScriptKind.TSX;
  return /\.(?:ts|mts|cts)$/.test(file) ? t.ScriptKind.TS : t.ScriptKind.JS;
};

const isTextLiteral = (t, node) => t.isStringLiteralLike(node) || t.isTemplateHead(node) || t.isTemplateMiddle(node) || t.isTemplateTail(node);

/** The findings of the string and template literals and the comments of one parsed source file. */
function sourceFindings(file, text) {
  const t = ts();
  const source = t.createSourceFile(file, text, t.ScriptTarget.Latest, true, scriptKindOf(t, file));
  const found = [];
  const lineOfPos = (pos) => source.getLineAndCharacterOfPosition(pos).line + 1;
  const literal = (node) => {
    const value = node.text;
    for (const hit of hostPathHits(value)) found.push(finding(file, lineOfPos(node.getStart(source)) + lineOf(value, hit.offset) - 1, hit));
  };
  const seenComments = new Set();
  const comments = (pos) => {
    for (const range of t.getLeadingCommentRanges(text, pos) ?? []) {
      if (seenComments.has(range.pos)) continue;
      seenComments.add(range.pos);
      const body = text.slice(range.pos, range.end);
      for (const hit of hostPathHits(body)) found.push(finding(file, lineOf(text, range.pos + hit.offset), hit));
    }
  };
  const visit = (node) => {
    if (isTextLiteral(t, node)) literal(node);
    comments(node.getFullStart());
    t.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** The RT_ABSOLUTE_PATH findings of one file's text (the file kind is read from its extension). */
export function absolutePathFindings(file, text) {
  if (SKIPPED.test(file)) return [];
  if (!SOURCE.test(file) && !LINE_TEXT.test(file)) return [];
  if (SOURCE.test(file)) return sourceFindings(file, text);
  return [...hostPathHits(text)].map((hit) => finding(file, lineOf(text, hit.offset), hit));
}

/** RT_ABSOLUTE_PATH over every tracked file of the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function absolutePathRepoFindings(ctx) {
  const found = [];
  for (const file of ctx.files) {
    if (!SOURCE.test(file) && !LINE_TEXT.test(file)) continue;
    const text = ctx.read(file);
    if (text !== null && text !== undefined) found.push(...absolutePathFindings(file, text));
  }
  return found;
}
