/**
 * HFS v2 check 7, duplicate blocks across owners (knowledge/hfs/slots.yaml ruleParams.<profile>.duplicateBlockLines = N):
 * a token-normalised block of at least N source lines that appears in two files of two different owner units is a
 * helper copied instead of shared. Clones inside one owner are that owner's business and are not judged.
 *
 * Normalisation: every production file is flattened into its syntax-node sequence (the compiler's parsed tree, walked in
 * source order; comments and whitespace do not exist in it), identifiers become one ID kind, string, template, numeric,
 * bigint and regex literals become one LIT kind, keywords and operators keep their own kind. Leading import and
 * export-from statements are dropped (imports repeat legitimately). A window is the run of tokens on N consecutive
 * physical lines starting at a line start whose last token reaches line N; windows are hashed with a rolling polynomial
 * hash (O(total tokens)), equal windows of two different owners are verified token by token, and overlapping hits on the
 * same file pair and offset merge into one maximal block. A block whose lines are mostly type declarations
 * (fewer than N/2 lines outside interface and type alias declarations) or of fewer than N/3 distinct line shapes
 * (a decorated DTO field list repeating one shape) is ignored.
 */
export const CLONE_RULE_IDS = ['HFS_DUPLICATE_BLOCK'];

const MAX_VIOLATIONS = 200;
const ID = -1;
const LIT = -2;

function tokenize(ts, sourceFile) {
  const { SyntaxKind } = ts;
  const literalKinds = new Set([SyntaxKind.StringLiteral, SyntaxKind.NumericLiteral, SyntaxKind.BigIntLiteral, SyntaxKind.RegularExpressionLiteral,
    SyntaxKind.NoSubstitutionTemplateLiteral, SyntaxKind.TemplateHead, SyntaxKind.TemplateMiddle, SyntaxKind.TemplateTail, SyntaxKind.JsxText]);
  const kinds = [];
  const lines = [];
  const types = [];
  const lineStarts = sourceFile.getLineStarts();
  const lineOf = (position) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (lineStarts[mid] <= position) low = mid; else high = mid - 1;
    }
    return low + 1;
  };
  const visit = (node, inType) => {
    const kind = node.kind;
    if (kind >= SyntaxKind.FirstJSDocNode && kind <= SyntaxKind.LastJSDocNode) return;
    if (kind === SyntaxKind.JsxText && node.containsOnlyTriviaWhiteSpaces) return;
    const typeScope = inType || kind === SyntaxKind.InterfaceDeclaration || kind === SyntaxKind.TypeAliasDeclaration;
    kinds.push(kind === SyntaxKind.Identifier || kind === SyntaxKind.PrivateIdentifier ? ID : literalKinds.has(kind) ? LIT : kind);
    lines.push(lineOf(node.getStart(sourceFile)));
    types.push(typeScope ? 1 : 0);
    ts.forEachChild(node, (child) => { visit(child, typeScope); });
  };
  for (const statement of sourceFile.statements) {
    if (statement.kind === SyntaxKind.ImportDeclaration || statement.kind === SyntaxKind.ImportEqualsDeclaration
      || (statement.kind === SyntaxKind.ExportDeclaration && statement.moduleSpecifier)) continue;
    visit(statement, false);
  }
  return { kinds: Int32Array.from(kinds), lines: Int32Array.from(lines), types: Uint8Array.from(types) };
}

function homeText(profile, rel) {
  if (profile === 'fe') {
    const app = /^apps\/([^/]+)\//.exec(rel)?.[1] ?? '<app>';
    return `move the shared helper to apps/${app}/src/modules/<capability>/ (pure) or apps/${app}/src/hooks/<domain>/ (React hook) and import it from both`;
  }
  return "move the shared helper to src/modules/platform/primitives/ or into the owning capability's src/modules/domain/<capability>/ and import it from both";
}

export function checkClones({ config, context, graph } = {}) {
  const N = graph.resolver.ruleParams().duplicateBlockLines;
  const ts = context.ts ?? context.loaded.ts;
  const entries = [];
  for (const rel of [...graph.files.keys()].sort()) {
    if (/\.d\.[cm]?tsx?$/.test(rel)) continue;
    const unit = graph.unit(rel);
    if (!unit) continue;
    entries.push({ rel, unit, ...tokenize(ts, graph.files.get(rel).sourceFile) });
  }
  // Rolling hash: two independent 32-bit polynomial prefix hashes, verified by token comparison on every match.
  const B1 = 1000003;
  const B2 = 92821;
  let maxTokens = 0;
  for (const file of entries) maxTokens = Math.max(maxTokens, file.kinds.length);
  const pow1 = new Int32Array(maxTokens + 1);
  const pow2 = new Int32Array(maxTokens + 1);
  pow1[0] = 1; pow2[0] = 1;
  for (let i = 1; i <= maxTokens; i += 1) { pow1[i] = Math.imul(pow1[i - 1], B1); pow2[i] = Math.imul(pow2[i - 1], B2); }
  const buckets = new Map();
  entries.forEach((file, fileIndex) => {
    const { kinds, lines } = file;
    const count = kinds.length;
    const pre1 = new Int32Array(count + 1);
    const pre2 = new Int32Array(count + 1);
    for (let i = 0; i < count; i += 1) {
      pre1[i + 1] = (Math.imul(pre1[i], B1) + kinds[i] + 3) | 0;
      pre2[i + 1] = (Math.imul(pre2[i], B2) + kinds[i] + 7) | 0;
    }
    let end = 0;
    for (let start = 0; start < count; start += 1) {
      if (start > 0 && lines[start] === lines[start - 1]) continue;
      const limit = lines[start] + N;
      if (end < start) end = start;
      while (end < count && lines[end] < limit) end += 1;
      if (end === start || lines[end - 1] - lines[start] + 1 < N) continue;
      const length = end - start;
      const key = `${(pre1[end] - Math.imul(pre1[start], pow1[length])) | 0}:${(pre2[end] - Math.imul(pre2[start], pow2[length])) | 0}:${length}`;
      const list = buckets.get(key);
      const item = [fileIndex, start, end];
      if (list) list.push(item); else buckets.set(key, [item]);
    }
  });
  const same = (a, b) => {
    const ka = entries[a[0]].kinds;
    const kb = entries[b[0]].kinds;
    for (let i = 0; i < a[2] - a[1]; i += 1) if (ka[a[1] + i] !== kb[b[1] + i]) return false;
    return true;
  };
  // Hits per (file a, file b, offset): merged into maximal blocks below.
  const hits = new Map();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (const item of list) {
      const unit = entries[item[0]].unit;
      const partner = list.find((other) => entries[other[0]].unit !== unit);
      if (!partner || !same(item, partner)) continue;
      const [a, b] = entries[item[0]].rel < entries[partner[0]].rel ? [item, partner] : [partner, item];
      const key = `${a[0]}|${b[0]}|${b[1] - a[1]}`;
      const group = hits.get(key);
      if (group) group.push([a[1], a[2]]); else hits.set(key, [[a[1], a[2]]]);
    }
  }
  const blocks = [];
  // Shape of a block: the lines outside type declarations and the number of distinct line shapes (a field list of
  // one decorated DTO shape repeated 25 times is boilerplate, not a copied helper).
  const blockShape = (file, start, end) => {
    const nonType = new Set();
    const shapes = new Map();
    for (let i = start; i < end; i += 1) {
      if (!file.types[i]) nonType.add(file.lines[i]);
      shapes.set(file.lines[i], ((shapes.get(file.lines[i]) ?? 7) * 31 + file.kinds[i] + 5) | 0);
    }
    return { nonType: nonType.size, distinct: new Set(shapes.values()).size };
  };
  for (const [key, group] of hits) {
    const [ai, bi, diagText] = key.split('|');
    const fileA = entries[Number(ai)];
    const fileB = entries[Number(bi)];
    const diag = Number(diagText);
    group.sort((x, y) => x[0] - y[0]);
    let [start, end] = group[0];
    const flush = () => {
      const shape = blockShape(fileA, start, end);
      if (shape.nonType < Math.ceil(N / 2) || shape.distinct < Math.ceil(N / 3)) return;
      const lineA = fileA.lines[start];
      const endA = fileA.lines[end - 1];
      blocks.push({ a: fileA, b: fileB, line: lineA, endLine: endA, lines: endA - lineA + 1,
        twin: { path: fileB.rel, line: fileB.lines[start + diag], endLine: fileB.lines[end - 1 + diag] } });
    };
    for (const [nextStart, nextEnd] of group.slice(1)) {
      if (nextStart <= end) { end = Math.max(end, nextEnd); continue; }
      flush();
      start = nextStart; end = nextEnd;
    }
    flush();
  }
  blocks.sort((x, y) => x.a.rel.localeCompare(y.a.rel) || x.line - y.line || x.b.rel.localeCompare(y.b.rel));
  const profile = graph.profile;
  const violations = blocks.slice(0, MAX_VIOLATIONS).map((block) => ({
    ruleId: 'HFS_DUPLICATE_BLOCK', path: block.a.rel, line: block.line, endLine: block.endLine, twin: block.twin, lines: block.lines,
    message: `${block.a.rel}:${block.line}-${block.endLine} duplicates ${block.twin.path}:${block.twin.line}-${block.twin.endLine} (${block.lines} lines, identifiers and literals ignored) across two owners; ${homeText(profile, block.a.rel)}.`,
  }));
  const owners = new Set();
  let duplicatedLines = 0;
  for (const block of blocks) { owners.add(block.a.unit); owners.add(block.b.unit); duplicatedLines += block.lines; }
  return { violations, coverage: { status: 'checked', minLines: N, files: entries.length, cloneBlocks: blocks.length, ownersInvolved: owners.size, duplicatedLines,
    ...(blocks.length > MAX_VIOLATIONS ? { truncated: true } : {}) } };
}
