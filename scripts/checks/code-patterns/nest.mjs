import fs from 'node:fs';
import path from 'node:path';
import { slash } from '../architecture/config.mjs';
import { loadTargetTypeScript } from '../architecture/typescript.mjs';
import { repositoryPath } from './common.mjs';

export const NEST_SCRIPT_RULES = Object.freeze([
  'NEST_MEMBER_DOCUMENTATION',
  'NEST_COMMENT_FORM',
  'NEST_IMPORT_FORMAT',
]);

function commentsOf(ts, source) {
  const comments = new Map();
  const add = ranges => { for (const item of ranges ?? []) comments.set(item.pos, item); };
  const visit = node => {
    // Parser token boundaries keep regex/template/string contents out of comment scanning.
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (node.kind >= ts.SyntaxKind.FirstToken && node.kind <= ts.SyntaxKind.LastToken) {
      add(ts.getLeadingCommentRanges(source.text, node.getFullStart()));
      add(ts.getTrailingCommentRanges(source.text, node.end));
      return;
    }
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  return [...comments.values()].sort((a, b) => a.pos - b.pos);
}

function checkSource(ts, source, relative, requested, violations) {
  const add = (ruleId, position, message) => {
    const point = source.getLineAndCharacterOfPosition(position);
    violations.push({ ruleId, path: relative, line: point.line + 1, column: point.character + 1, message });
  };
  const comments = commentsOf(ts, source);
  const docs = comments.filter(item => source.text.startsWith('/**', item.pos));
  const bodies = [];
  const docFor = node => {
    let owner = node;
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      if (ts.isVariableDeclaration(node.parent)) {
        owner = node.parent.parent.parent;
      } else if (ts.isPropertyDeclaration(node.parent)) owner = node.parent;
    }
    const before = owner.name?.getStart(source) ?? owner.parameters?.pos ?? owner.getStart(source);
    const decorators = ts.canHaveDecorators(owner) ? ts.getDecorators(owner) ?? [] : [];
    return docs.filter(item => item.pos >= owner.getFullStart() && item.end <= before
      && !decorators.some(decorator => item.pos >= decorator.getStart(source) && item.end <= decorator.end)).at(-1);
  };
  const visit = node => {
    if (ts.isFunctionLike(node) && node.body && ts.isBlock(node.body)) bodies.push(node.body);
    if (requested.has('NEST_MEMBER_DOCUMENTATION')) {
      const member = ts.isMethodDeclaration(node) || ts.isMethodSignature(node)
        || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)
        || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
        || (ts.isParameter(node) && Boolean(ts.getModifiers(node)?.some(modifier =>
          [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind))));
      const generic = Boolean(node.typeParameters?.length);
      const doc = (member || generic) ? docFor(node) : null;
      const content = doc ? source.text.slice(doc.pos + 3, doc.end - 2).replace(/^\s*\*/gm, '').trim() : '';
      if (member && !content) add('NEST_MEMBER_DOCUMENTATION', node.getStart(source), 'Methods and declared class/interface/type fields require a nonempty responsibility docblock.');
      if (generic) {
        const tags = new Set([...content.matchAll(/@(?:template|typeParam)\s+([A-Za-z_$][\w$]*(?:\s*,\s*[A-Za-z_$][\w$]*)*)/g)]
          .flatMap(match => match[1].split(',').map(value => value.trim())));
        for (const parameter of node.typeParameters) {
          if (!tags.has(parameter.name.text)) add('NEST_MEMBER_DOCUMENTATION', parameter.getStart(source), 'Each declared generic parameter requires its own @template or @typeParam documentation.');
        }
      }
    }
    if (requested.has('NEST_IMPORT_FORMAT') && ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        const start = source.getLineAndCharacterOfPosition(bindings.getStart(source)).line;
        const end = source.getLineAndCharacterOfPosition(bindings.end - 1).line;
        const lines = bindings.elements.map(element => ({
          first: source.getLineAndCharacterOfPosition(element.getStart(source)).line,
          last: source.getLineAndCharacterOfPosition(element.end - 1).line,
        }));
        const bad = start === end || lines.some(item => item.first <= start || item.last >= end || item.first !== item.last)
          || new Set(lines.map(item => item.first)).size !== lines.length
          || (bindings.elements.length > 0 && !bindings.elements.hasTrailingComma);
        if (bad) add('NEST_IMPORT_FORMAT', bindings.getStart(source), 'Named import braces use separate lines, one complete binding per line, and a trailing comma for nonempty bindings.');
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!requested.has('NEST_COMMENT_FORM')) return;
  for (const comment of comments) {
    const raw = source.text.slice(comment.pos, comment.end);
    const line = source.getLineAndCharacterOfPosition(comment.pos).line;
    const lineStart = source.getPositionOfLineAndCharacter(line, 0);
    const trailing = source.text.slice(lineStart, comment.pos).trim().length > 0;
    if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      // These are declared compiler/locale annotations, not prose comment exceptions.
      if (/^\/\/\/\s*<(?:reference|amd-module|amd-dependency)\b/.test(raw) || /^\/\/\s*vn-ok:\s*\S/.test(raw)) continue;
      const content = raw.slice(2).trim();
      if (!content) continue;
      const firstLetter = content.match(/[A-Za-z]/)?.[0];
      if (trailing || (firstLetter && firstLetter === firstLetter.toUpperCase())) add('NEST_COMMENT_FORM', comment.pos, 'Prose line comments stand above code and start in lowercase sentence form.');
    } else if (!raw.startsWith('/**') && bodies.some(body => comment.pos > body.pos && comment.end < body.end)) {
      const content = raw.slice(2, -2).replace(/^\s*\*/gm, '').trim();
      const firstLetter = content.match(/[A-Za-z]/)?.[0];
      if (firstLetter && firstLetter === firstLetter.toLowerCase()) add('NEST_COMMENT_FORM', comment.pos, 'Reasoning block comments inside a function body open with a capitalized claim.');
    }
  }
}

/** Check only the declared Nest syntax rules; documentation meaning remains agent-reviewed. */
export function checkNestPatterns({ root, files, ruleIds } = {}) {
  const repository = typeof root === 'string' ? path.resolve(root) : '';
  const result = { schema: 'starci/code-pattern-script@1', repository, files: [], requestedRuleIds: ruleIds ?? [], checkedRuleIds: [], violations: [], errors: [], compiler: null };
  const fail = message => { result.errors.push({ message }); return result; };
  if (!repository || !Array.isArray(files) || files.length === 0 || !Array.isArray(ruleIds) || ruleIds.length === 0) return fail('Root, nonempty explicit files and at least one supported rule ID are required.');
  if (new Set(ruleIds).size !== ruleIds.length || ruleIds.some(id => !NEST_SCRIPT_RULES.includes(id))) return fail('Unknown or duplicate Nest syntax rule ID.');
  if (new Set(files).size !== files.length) return fail('Duplicate input file.');
  let compiler;
  try { compiler = loadTargetTypeScript(repository); } catch (error) { return fail(String(error.message)); }
  result.compiler = { version: compiler.version, resolved: compiler.resolved };
  const requested = new Set(ruleIds);
  for (const relative of [...files].sort()) {
    if (typeof relative !== 'string' || relative.includes('\\') || path.posix.normalize(relative) !== relative || path.isAbsolute(relative) || !relative.endsWith('.ts') || relative.endsWith('.d.ts')) {
      result.errors.push({ path: typeof relative === 'string' ? relative : undefined, message: 'Expected a normalized relative .ts source path, excluding declarations.' });
      continue;
    }
    try {
      const absolute = repositoryPath(repository, relative, 'Source');
      const text = fs.readFileSync(absolute, 'utf8');
      const source = compiler.ts.createSourceFile(absolute, text, compiler.ts.ScriptTarget.Latest, true, compiler.ts.ScriptKind.TS);
      if (source.parseDiagnostics.length) {
        result.errors.push({ path: relative, message: 'TypeScript syntax is invalid; code-pattern coverage is unavailable.' });
        continue;
      }
      checkSource(compiler.ts, source, slash(relative), requested, result.violations);
      result.files.push(relative);
    } catch (error) { result.errors.push({ path: relative, message: String(error.message) }); }
  }
  if (result.errors.length === 0) result.checkedRuleIds = [...ruleIds].sort();
  return result;
}
