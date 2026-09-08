// Generate the "<Topic> Common already owns" table in every `knowledge/ui/presentation` topic from
// the live `@grammar/core` package, so the ownership tables stop being hand-written prose that
// drifts away from the components they describe.
//
// Every Grammar element publishes the identifiers it claims as `data-contract`. That attribute is
// the only input here: the script parses `packages/grammar/src/core/**/*.ts|tsx`, resolves each
// `data-contract` value (a static string, a template, a ternary, a local constant, a lookup map, or
// a helper function), and prints one row per component, element-or-condition, and rule id. It never
// prints a value the source does not state: the generated table carries the rule id alone, and the
// CSS stays the authority on what that rule resolves to.
//
// "Element or condition" is read from the source too, in this order: an element carrying
// `data-component="<Component>"`, or the component's own returned root, is `root`; otherwise the
// element's `data-grammar-*` marker, its `*ClassName` binding or `starci-core-*` class, its only
// child, or its tag. When the claim is computed the prop condition that selects it is appended, as
// `composition="joined"` or `density="comfortable"`.
//
// Usage:
//   node scripts/generate-presentation-owned.mjs [--grammar <path to packages/grammar>]
//   node scripts/generate-presentation-owned.mjs --check      exits 1 when the committed tables differ
//
// NOT part of `npm test`: like `generate-grammar-dna.mjs` it needs the routed FE checkout on disk,
// which CI and a fresh clone do not have. It additionally needs that checkout's own `typescript`,
// because a claim's element and condition are read from the syntax tree rather than guessed with a
// regular expression. Run it by hand after a Grammar change, and verify with `--check`.
import { createRequire } from 'node:module';
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const claudeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(claudeRoot, '..');
const knowledgeDir = path.join(claudeRoot, 'knowledge');
const presentationDir = path.join(knowledgeDir, 'ui', 'presentation');

const argv = process.argv.slice(2);
const checkOnly = argv.includes('--check');
const grammarFlag = argv.indexOf('--grammar');

function resolveGrammarRoot() {
  if (grammarFlag !== -1) {
    const given = argv[grammarFlag + 1];
    if (!given) throw new Error('--grammar needs a path');
    return path.resolve(given);
  }
  const route = path.join(sourceRoot, '.workspaces', 'local', 'routes', 'starci-academy', 'fe', 'config.json');
  if (!existsSync(route)) throw new Error(`no routed FE checkout: ${route} is missing (pass --grammar <path>)`);
  const diskPath = JSON.parse(readFileSync(route, 'utf8')).repository?.diskPath;
  if (!diskPath) throw new Error(`${route}: repository.diskPath is absent`);
  return path.join(diskPath, 'packages', 'grammar');
}

const grammarRoot = resolveGrammarRoot();
const srcDir = path.join(grammarRoot, 'src');
if (!existsSync(srcDir)) throw new Error(`${srcDir} is not a Grammar checkout`);

// The checkout's own compiler, so the tree that is parsed is the one the package builds with.
function loadTypeScript() {
  for (const from of [grammarRoot, path.resolve(grammarRoot, '..', '..')]) {
    try {
      return createRequire(path.join(from, 'package.json'))('typescript');
    } catch { /* try the next resolution root */ }
  }
  throw new Error(`typescript is not installed in ${grammarRoot}: run the FE checkout's install first`);
}
const ts = loadTypeScript();

const read = (p) => readFileSync(p, 'utf8');

// ---------------------------------------------------------------- topics
// One entry per presentation topic. `heading` is the exact block heading each file already carries;
// the generator rewrites the block between it and the next `## `, and never invents a heading text.
// `font.md` and `tone.md` carry no such block yet, so `insertBefore` names the rule heading the new
// block is placed above.
const TOPICS = [
  { prefix: 'GAP', file: 'gap', heading: 'Gaps Common already owns', vi: 'Gap mà Common đã sở hữu' },
  { prefix: 'PADDING', file: 'padding', heading: 'Padding Common already owns', vi: 'Padding mà Common đã sở hữu' },
  { prefix: 'MARGIN', file: 'margin', heading: 'Margin Common already owns', vi: 'Margin mà Common đã sở hữu' },
  { prefix: 'FONT', file: 'font', heading: 'Font Common already owns', vi: 'Font mà Common đã sở hữu', insertBefore: 'FONT-1' },
  { prefix: 'TONE', file: 'tone', heading: 'Tone Common already owns', vi: 'Tone mà Common đã sở hữu', insertBefore: 'TONE-1' },
  { prefix: 'MEASURE', file: 'measure', heading: 'Measure Common already owns', vi: 'Measure mà Common đã sở hữu' },
  { prefix: 'FLOW', file: 'text-flow', heading: 'Text flow Common already owns', vi: 'Text flow mà Common đã sở hữu' },
  { prefix: 'OVERFLOW', file: 'overflow', heading: 'Overflow Common already owns', vi: 'Overflow mà Common đã sở hữu' },
  { prefix: 'SURFACE', file: 'surface', heading: 'Surfaces Common already owns', vi: 'Surface mà Common đã sở hữu' },
  { prefix: 'BOUNDARY', file: 'boundary', heading: 'Boundaries Common already owns', vi: 'Boundary mà Common đã sở hữu' },
];

// ---------------------------------------------------------------- published rule ids
// A rule exists only as a `## PREFIX-n — …` heading in a canonical knowledge file, the same
// inventory `validate-knowledge-citations.mjs` builds. Only ids of the ten presentation prefixes can
// appear in these tables, so the scan is narrowed to them.
const HEADING = /^## ([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-(?:\d+|AUTO))\b/;
function walkMd(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMd(full));
    else if (entry.name.endsWith('.md') && !entry.name.endsWith('.vi.md')) out.push(full);
  }
  return out;
}
const prefixes = new Set(TOPICS.map((t) => t.prefix));
const publishedIds = new Set();
for (const file of walkMd(knowledgeDir)) {
  for (const line of read(file).split(/\r?\n/)) {
    const m = HEADING.exec(line);
    if (m && prefixes.has(m[1].replace(/-(?:\d+|AUTO)$/, ''))) publishedIds.add(m[1]);
  }
}
if (publishedIds.size === 0) throw new Error('no presentation rule ids are published');
const ID_RE = new RegExp(`\\b(?:${[...publishedIds].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');

// ---------------------------------------------------------------- source files
function walkSource(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { out.push(...walkSource(full)); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (entry.name.includes('.spec.') || entry.name.includes('.test.')) continue;
    out.push(full);
  }
  return out;
}
// `core/**` holds every renderer folder plus the three bare renderers that are a file of their own.
const sourceFiles = walkSource(path.join(srcDir, 'core')).sort();
// A renderer folder is one unit: `Label/index.tsx` claims through `Label/classNames.ts`, so module
// scope is resolved across the folder rather than per file.
const folderFiles = new Map();
for (const file of sourceFiles) {
  const folder = path.dirname(file);
  if (!folderFiles.has(folder)) folderFiles.set(folder, []);
  folderFiles.get(folder).push(file);
}

// ---------------------------------------------------------------- naming helpers
const words = (text) => text
  .replace(/[^A-Za-z0-9]+/g, ' ')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean);

// A role reads as the part of the name the component itself does not already say: inside
// `SurfaceCard`, `data-grammar-surface-label` is the "label", not the "surface label".
function roleFrom(name, component) {
  const own = words(component);
  const parts = words(name);
  let i = 0;
  while (i < parts.length && i < own.length && parts[i] === own[i]) i += 1;
  const rest = parts.slice(i);
  return rest.length === 0 ? '' : rest.join(' ');
}

// ---------------------------------------------------------------- per-file analysis
const claims = []; // { component, role, conditions[], id }

const textOf = (node) => node.getText().replace(/\s+/g, ' ').trim();

// `as const`, `satisfies X` and parentheses wrap a value without changing it, and a lookup map that
// keeps its wrapper would be walked as plain text instead of keyed by the prop that selects a row.
function unwrap(node) {
  if (!node) return node;
  const kind = node.kind;
  if (kind === ts.SyntaxKind.AsExpression || kind === ts.SyntaxKind.SatisfiesExpression
    || kind === ts.SyntaxKind.ParenthesizedExpression || kind === ts.SyntaxKind.TypeAssertionExpression) {
    return unwrap(node.expression);
  }
  return node;
}

const parsed = new Map();
for (const file of sourceFiles) {
  parsed.set(file, ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
}

for (const file of sourceFiles) {
  const sourceFile = parsed.get(file);
  const folder = path.dirname(file);

  // ---- the bindings an identifier can resolve to. Module scope spans the whole renderer folder,
  // because `Label/index.tsx` claims through `Label/classNames.ts`; block scope is resolved against
  // the innermost enclosing block, because `SurfaceCard` assembles `contentContract` inside its own
  // body and two components in one file may name their locals alike.
  const declarations = new Map(); // name -> initializer or function body
  const exported = new Set();
  for (const sibling of folderFiles.get(folder)) {
    for (const statement of parsed.get(sibling).statements) {
      const isExported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
          declarations.set(decl.name.text, unwrap(decl.initializer));
          if (isExported) exported.add(decl.name.text);
        }
      } else if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
        declarations.set(statement.name.text, statement.body);
        if (isExported) exported.add(statement.name.text);
      }
    }
  }

  const locals = new Map(); // name -> [{ scope, init }]
  const visitLocals = (node) => {
    if (ts.isVariableStatement(node) && node.parent !== sourceFile) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        if (!locals.has(decl.name.text)) locals.set(decl.name.text, []);
        locals.get(decl.name.text).push({ scope: node.parent, init: unwrap(decl.initializer) });
      }
    }
    ts.forEachChild(node, visitLocals);
  };
  visitLocals(sourceFile);

  function lookup(name, at) {
    const candidates = (locals.get(name) ?? []).filter((c) => c.scope.getSourceFile() === at.getSourceFile()
      && c.scope.pos <= at.pos && at.end <= c.scope.end);
    if (candidates.length > 0) return candidates.sort((a, b) => b.scope.pos - a.scope.pos)[0].init;
    return declarations.get(name);
  }

  // ---- the component that owns a node: the nearest enclosing top-level `Name = …` declaration.
  // A private helper renderer claims under the public component of its folder, because the private
  // name is not a component an application can compose.
  const folderName = path.basename(folder) === 'core' ? path.basename(file, path.extname(file)) : path.basename(folder);
  function componentOf(node) {
    let name;
    for (let cur = node; cur && name === undefined; cur = cur.parent) {
      if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name) && /^[A-Z]/.test(cur.name.text)) name = cur.name.text;
      else if (ts.isFunctionDeclaration(cur) && cur.name && /^[A-Z]/.test(cur.name.text)) name = cur.name.text;
    }
    if (name === undefined) return folderName;
    return exported.has(name) ? name : exported.has(folderName) ? folderName : name;
  }

  // ---- the JSX elements a component returns, which are its roots.
  const rootsByComponent = new Map();
  function collectRoots(expr, into) {
    if (!expr) return;
    if (ts.isParenthesizedExpression(expr)) return collectRoots(expr.expression, into);
    if (ts.isConditionalExpression(expr)) { collectRoots(expr.whenTrue, into); collectRoots(expr.whenFalse, into); return; }
    if (ts.isJsxElement(expr)) { into.add(expr.openingElement); return; }
    if (ts.isJsxSelfClosingElement(expr)) { into.add(expr); return; }
  }
  const visitComponents = (node) => {
    const name = ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) ? node.name.text
      : ts.isFunctionDeclaration(node) && node.name ? node.name.text : undefined;
    const body = ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
      ? node.initializer.body
      : ts.isFunctionDeclaration(node) ? node.body : undefined;
    if (name && /^[A-Z]/.test(name) && body) {
      const roots = new Set();
      if (ts.isBlock(body)) {
        const scan = (n) => {
          if (ts.isReturnStatement(n)) collectRoots(n.expression, roots);
          if (!ts.isArrowFunction(n) && !ts.isFunctionExpression(n) && !ts.isFunctionDeclaration(n)) ts.forEachChild(n, scan);
        };
        ts.forEachChild(body, scan);
      } else collectRoots(body, roots);
      rootsByComponent.set(name, roots);
    }
    ts.forEachChild(node, visitComponents);
  };
  visitComponents(sourceFile);

  // ---- condition rendering, always in the vocabulary the source itself uses.
  function setMembers(node) {
    if (!ts.isNewExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'Set') return undefined;
    const arg = node.arguments?.[0];
    if (!arg || !ts.isArrayLiteralExpression(arg)) return undefined;
    const values = arg.elements.filter(ts.isStringLiteralLike).map((e) => `"${e.text}"`);
    return values.length === arg.elements.length && values.length > 0 ? values : undefined;
  }

  function conditionText(node, negated) {
    if (ts.isParenthesizedExpression(node)) return conditionText(node.expression, negated);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      return conditionText(node.operand, !negated);
    }
    if (ts.isBinaryExpression(node)) {
      const eq = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken;
      const ne = node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
      if (eq || ne) {
        const op = (eq ? !negated : negated) ? '=' : '!=';
        return `${textOf(node.left)}${op}${textOf(node.right)}`;
      }
      if (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && !negated) {
        return [conditionText(node.left, false), conditionText(node.right, false)].join(', ');
      }
    }
    // `SOME_SET.has(prop)` names a closed alternative, so it prints as that alternative.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'has'
      && ts.isIdentifier(node.expression.expression) && node.arguments.length === 1) {
      const decl = lookup(node.expression.expression.text, node.expression.expression);
      const members = decl ? setMembers(decl) : undefined;
      if (members) return `${textOf(node.arguments[0])}${negated ? ' not in ' : '='}${members.join('|')}`;
    }
    const text = textOf(node);
    // A compound expression keeps its parentheses under negation, so `not a || b` cannot be read
    // as negating only `a`.
    if (!negated) return text;
    return ts.isBinaryExpression(node) || ts.isConditionalExpression(node) ? `not (${text})` : `not ${text}`;
  }

  // Conditions gathered walking from `node` up to `stop`. `stop` itself is examined, because a
  // `data-contract={a ? "X" : "Y"}` attribute is entered at the conditional and the branch is the
  // whole condition.
  function conditionsUpTo(node, stop) {
    const out = [];
    for (let cur = node; cur && cur !== stop; cur = cur.parent) {
      const parent = cur.parent;
      if (!parent) break;
      if (ts.isConditionalExpression(parent)) {
        if (parent.whenTrue === cur) out.unshift(conditionText(parent.condition, false));
        else if (parent.whenFalse === cur) out.unshift(conditionText(parent.condition, true));
      } else if (ts.isIfStatement(parent)) {
        if (parent.thenStatement === cur) out.unshift(conditionText(parent.expression, false));
        else if (parent.elseStatement === cur) out.unshift(conditionText(parent.expression, true));
      } else if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.right === cur) {
        out.unshift(conditionText(parent.left, false));
      } else if (ts.isCaseClause(parent)) {
        const scrutinee = parent.parent?.parent;
        if (scrutinee && ts.isSwitchStatement(scrutinee)) {
          out.unshift(`${textOf(scrutinee.expression)}=${textOf(parent.expression)}`);
        }
      }
    }
    return out;
  }

  // ---- claim collection. `base` is the condition set already established by the caller, and
  // `seen` the names already followed, which is both the recursion guard and the list of local
  // bindings whose own presence tests (`toneRule !== undefined`) are plumbing rather than a
  // published condition.
  function collect(node, base, seen, emit) {
    if (!node) return;
    const walk = (cur) => {
      if (ts.isStringLiteralLike(cur) || ts.isTemplateHead(cur) || ts.isTemplateMiddle(cur) || ts.isTemplateTail(cur)) {
        const found = (cur.text ?? '').match(ID_RE);
        if (found) {
          const conds = [...base, ...conditionsUpTo(cur, node)];
          for (const id of found) emit(id, conds, seen);
        }
        return;
      }
      // `MAP[key]`: each entry is claimed under the key that selects it, and a literal key selects
      // exactly one entry under no condition at all.
      if (ts.isElementAccessExpression(cur) && ts.isIdentifier(cur.expression)) {
        const decl = lookup(cur.expression.text, cur.expression);
        if (decl && ts.isObjectLiteralExpression(decl) && !seen.has(cur.expression.text)) {
          const key = textOf(cur.argumentExpression);
          const fixed = ts.isStringLiteralLike(cur.argumentExpression) || ts.isNumericLiteral(cur.argumentExpression)
            ? cur.argumentExpression.text
            : undefined;
          const conds = [...base, ...conditionsUpTo(cur, node)];
          const next = new Set([...seen, cur.expression.text]);
          for (const prop of decl.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const name = ts.isStringLiteralLike(prop.name) || ts.isIdentifier(prop.name) || ts.isNumericLiteral(prop.name)
              ? prop.name.text : undefined;
            if (name === undefined) continue;
            if (fixed !== undefined) {
              if (name !== fixed) continue;
              collect(prop.initializer, conds, next, emit);
              continue;
            }
            const literal = /^[0-9]+$/.test(name) ? name : `"${name}"`;
            collect(prop.initializer, [...conds, `${key}=${literal}`], next, emit);
          }
          return;
        }
      }
      // A helper or constant is followed once, so a claim assembled elsewhere still lands. The
      // receiver of a property access is never followed: `ids.push(…)` and `ids.join(" ")` name a
      // working list whose contents this walk already reads in place, and following it would
      // re-claim every entry under the condition of the branch that happens to be pushing.
      if (ts.isIdentifier(cur) && !seen.has(cur.text)
        && !(cur.parent && ts.isPropertyAccessExpression(cur.parent))) {
        const decl = lookup(cur.text, cur);
        if (decl) {
          const conds = [...base, ...conditionsUpTo(cur, node)];
          collect(decl, conds, new Set([...seen, cur.text]), emit);
          return;
        }
      }
      ts.forEachChild(cur, walk);
    };
    // A switch inside a followed helper needs its case labels, which `conditionsUpTo` reaches
    // through the clause it starts from; nothing extra is needed here.
    walk(node);
  }

  // ---- the attribute bag a claim sits in, and the role it names.
  function bagEntries(bag) {
    if (bag.kind === 'jsx') {
      return bag.node.attributes.properties.flatMap((p) => {
        if (ts.isJsxAttribute(p) && ts.isIdentifier(p.name)) return [[p.name.text, p.initializer]];
        if (ts.isJsxAttribute(p) && p.name.kind === ts.SyntaxKind.JsxNamespacedName) return [];
        return [];
      });
    }
    return bag.node.properties.flatMap((p) => {
      if (!ts.isPropertyAssignment(p)) return [];
      const name = ts.isStringLiteralLike(p.name) || ts.isIdentifier(p.name) ? p.name.text : undefined;
      return name === undefined ? [] : [[name, p.initializer]];
    });
  }

  function attributeValueText(value) {
    if (!value) return undefined;
    if (ts.isStringLiteralLike(value)) return value.text;
    if (ts.isJsxExpression(value)) return value.expression ? attributeValueText(value.expression) : undefined;
    return undefined;
  }

  function classNameRole(value, component) {
    const inner = value && ts.isJsxExpression(value) ? value.expression : value;
    if (!inner) return undefined;
    if (ts.isIdentifier(inner) && /ClassName$/.test(inner.text)) return roleFrom(inner.text.replace(/ClassName$/, ''), component);
    const literals = [];
    const scan = (n) => { if (ts.isStringLiteralLike(n)) literals.push(n.text); ts.forEachChild(n, scan); };
    scan(inner);
    for (const literal of literals) {
      const token = literal.split(/\s+/).find((t) => t.startsWith('starci-core-'));
      if (token) return roleFrom(token.replace(/^starci-core-/, ''), component);
    }
    return undefined;
  }

  function childRole(element) {
    const parent = element.parent;
    if (!parent || !ts.isJsxElement(parent)) return undefined;
    const children = parent.children.filter((c) => !(ts.isJsxText(c) && c.text.trim() === ''));
    if (children.length !== 1) return undefined;
    const only = children[0];
    if (ts.isJsxExpression(only) && only.expression && (ts.isIdentifier(only.expression) || ts.isPropertyAccessExpression(only.expression))) {
      return words(textOf(only.expression)).join(' ');
    }
    if (ts.isJsxElement(only)) return `${words(textOf(only.openingElement.tagName)).join(' ')} wrapper`;
    if (ts.isJsxSelfClosingElement(only)) return `${words(textOf(only.tagName)).join(' ')} wrapper`;
    return undefined;
  }

  function roleOf(bag, component) {
    const entries = bagEntries(bag);
    const byName = new Map(entries);
    if (attributeValueText(byName.get('data-component')) === component) return 'root';
    if (bag.kind === 'jsx' && rootsByComponent.get(component)?.has(bag.node)) return 'root';
    if (bag.kind === 'object' && bag.spreadRoots) return 'root';
    for (const [name, value] of entries) {
      if (!name.startsWith('data-grammar-')) continue;
      if (attributeValueText(value) !== 'true') continue;
      const role = roleFrom(name.replace(/^data-grammar-/, ''), component);
      return role === '' ? 'root' : role;
    }
    const fromClass = classNameRole(byName.get('className'), component);
    if (fromClass !== undefined) return fromClass === '' ? 'root' : fromClass;
    if (bag.kind === 'jsx') {
      const element = ts.isJsxOpeningElement(bag.node) ? bag.node.parent : bag.node;
      const child = ts.isJsxElement(element) ? childRole(ts.isJsxElement(element) ? element.openingElement : element) : undefined;
      if (child) return child;
      return words(textOf(bag.node.tagName)).join(' ');
    }
    return 'root';
  }

  // ---- every `data-contract` site in the file.
  const visitSites = (node) => {
    let value;
    let bag;
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'data-contract') {
      value = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      const attributes = node.parent;
      bag = { kind: 'jsx', node: attributes.parent };
    } else if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.name) && node.name.text === 'data-contract') {
      value = node.initializer;
      const object = node.parent;
      // The object may be spread straight into an element, or held by a `const` that is.
      let owner;
      for (let cur = object; cur; cur = cur.parent) {
        if (ts.isJsxSpreadAttribute(cur)) { owner = cur.parent.parent; break; }
        if (ts.isVariableDeclaration(cur)) break;
      }
      if (owner) bag = { kind: 'jsx', node: owner };
      else {
        const held = (() => {
          for (let cur = object; cur; cur = cur.parent) {
            if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) return cur.name.text;
          }
          return undefined;
        })();
        let spreadRoots = false;
        if (held) {
          const component = componentOf(node);
          const roots = rootsByComponent.get(component) ?? new Set();
          const scan = (n) => {
            if (ts.isJsxSpreadAttribute(n) && ts.isIdentifier(n.expression) && n.expression.text === held) {
              if (roots.has(n.parent.parent)) spreadRoots = true;
            }
            ts.forEachChild(n, scan);
          };
          scan(sourceFile);
        }
        bag = { kind: 'object', node: object, spreadRoots };
      }
    }
    if (value && bag) {
      const component = componentOf(node);
      const role = roleOf(bag, component);
      const outer = conditionsUpTo(node, undefined).filter(Boolean);
      const seenIds = new Set();
      collect(value, outer, new Set(), (id, conds, followed) => {
        const kept = normaliseConditions(conds, followed);
        if (kept === undefined) return; // the branch contradicts itself, so it never renders
        const key = `${id} ${kept.join(', ')}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        claims.push({ component, role, conditions: kept, id });
      });
    }
    ts.forEachChild(node, visitSites);
  };
  visitSites(sourceFile);
}

// ---------------------------------------------------------------- condition hygiene
// A collected condition list can carry three kinds of noise, all of which say nothing about the
// props a caller passes: a test on a local binding the walk itself followed, an inequality already
// settled by an equality on the same subject, and a pair that cannot both hold, which means the
// branch never renders.
function escapeRe(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function subjectOf(cond) {
  const m = /^([^=!]+?)(!=|=)(.*)$/.exec(cond);
  return m ? { subject: m[1].trim(), negated: m[2] === '!=', value: m[3].trim() } : undefined;
}

function normaliseConditions(conds, followed) {
  const plumbing = [...followed].map((name) => new RegExp(`^(not )?${escapeRe(name)}($|[=!\\s])`));
  const kept = conds.filter((cond) => !plumbing.some((re) => re.test(cond)));
  const equal = new Map();
  for (const cond of kept) {
    const parsed = subjectOf(cond);
    if (parsed && !parsed.negated) {
      if (equal.has(parsed.subject) && equal.get(parsed.subject) !== parsed.value) return undefined;
      equal.set(parsed.subject, parsed.value);
    }
  }
  const out = [];
  for (const cond of kept) {
    const parsed = subjectOf(cond);
    if (parsed?.negated && equal.has(parsed.subject)) {
      if (equal.get(parsed.subject) === parsed.value) return undefined;
      continue; // `level=1` already says everything `level!=4` said
    }
    if (!out.includes(cond)) out.push(cond);
  }
  return out;
}

// Two rows that differ only by one condition and its negation cover every case between them, so the
// pair collapses to the condition they share.
function complementary(a, b) {
  if (a.length !== b.length) return -1;
  let at = -1;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (at !== -1) return -1;
    const x = subjectOf(a[i]);
    const y = subjectOf(b[i]);
    const opposite = (x && y && x.subject === y.subject && x.value === y.value && x.negated !== y.negated)
      || a[i] === `not ${b[i]}` || b[i] === `not ${a[i]}`;
    if (!opposite) return -1;
    at = i;
  }
  return at;
}

function collapse(rows) {
  let list = rows.map((r) => ({ ...r }));
  for (let changed = true; changed;) {
    changed = false;
    outer:
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (list[i].component !== list[j].component || list[i].role !== list[j].role || list[i].id !== list[j].id) continue;
        const at = complementary(list[i].conditions, list[j].conditions);
        if (at === -1) continue;
        const merged = list[i].conditions.filter((_, k) => k !== at);
        list = [...list.filter((_, k) => k !== i && k !== j), { ...list[i], conditions: merged }];
        changed = true;
        break outer;
      }
    }
  }
  // A claim already made under fewer conditions subsumes the narrower one: `root` covers
  // `root, not isClientReady`, and an unconditional claim covers every conditional one.
  return list.filter((row) => !list.some((other) => other !== row
    && other.component === row.component && other.role === row.role && other.id === row.id
    && other.conditions.length < row.conditions.length
    && other.conditions.every((c) => row.conditions.includes(c))));
}

// ---------------------------------------------------------------- rows
const ordinal = (id) => {
  const n = id.replace(/^.*-/, '');
  return n === 'AUTO' ? Number.MAX_SAFE_INTEGER : Number(n);
};

function rowsFor(prefix) {
  const unique = new Map();
  for (const claim of claims) {
    if (claim.id.replace(/-(?:\d+|AUTO)$/, '') !== prefix) continue;
    const key = `${claim.component}|${claim.role}|${claim.id}|${claim.conditions.join(', ')}`;
    if (!unique.has(key)) unique.set(key, claim);
  }
  const seen = new Map();
  for (const claim of collapse([...unique.values()])) {
    const where = [claim.role, ...claim.conditions].filter(Boolean).join(', ');
    const key = `${claim.component} ${where} ${claim.id}`;
    if (!seen.has(key)) seen.set(key, { component: claim.component, where, id: claim.id });
  }
  return [...seen.values()].sort((a, b) => a.component.localeCompare(b.component)
    || a.where.localeCompare(b.where)
    || ordinal(a.id) - ordinal(b.id));
}

const EN_NOTE = 'Generated from `@grammar/core` claims by `scripts/generate-presentation-owned.mjs`; edit the component, not this table.';
const VI_NOTE = 'Sinh từ claim của `@grammar/core` bằng `scripts/generate-presentation-owned.mjs`; muốn đổi thì sửa component, đừng sửa bảng này.';

function block(heading, note, header, rows) {
  const lines = [`## ${heading}`, '', note, '', header, '| --- | --- | --- |'];
  if (rows.length === 0) lines.push('| — | — | — |');
  else for (const row of rows) lines.push(`| \`${row.component}\` | ${row.where} | ${row.id} |`);
  lines.push('');
  return lines;
}

// Replace the block between `## <heading>` and the next `## `, or insert it above `insertBefore`.
function rewrite(text, heading, note, header, rows, insertBefore) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  const body = block(heading, note, header, rows);
  if (start !== -1) {
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('## ')) end += 1;
    return [...lines.slice(0, start), ...body, ...lines.slice(end)].join('\n');
  }
  if (!insertBefore) throw new Error(`no "## ${heading}" block and no insertion point`);
  const at = lines.findIndex((line) => line.startsWith(`## ${insertBefore} `));
  if (at === -1) throw new Error(`cannot place "## ${heading}": no "## ${insertBefore}" heading`);
  return [...lines.slice(0, at), ...body, ...lines.slice(at)].join('\n');
}

const outputs = [];
const counts = [];
for (const topic of TOPICS) {
  const rows = rowsFor(topic.prefix);
  counts.push(`${topic.prefix} ${rows.length}`);
  const en = path.join(presentationDir, `${topic.file}.md`);
  const vi = path.join(presentationDir, `${topic.file}.vi.md`);
  outputs.push([en, rewrite(read(en), topic.heading, EN_NOTE, '| Component | Element or condition | Rule |', rows, topic.insertBefore)]);
  outputs.push([vi, rewrite(read(vi), topic.vi, VI_NOTE, '| Component | Phần tử hoặc điều kiện | Rule |', rows, topic.insertBefore)]);
}

if (checkOnly) {
  const drifted = outputs.filter(([file, text]) => !existsSync(file) || read(file) !== text);
  if (drifted.length > 0) {
    process.stderr.write(`presentation owned tables are stale: ${drifted.map(([f]) => path.relative(claudeRoot, f)).join(', ')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`presentation owned tables current: ${counts.join(', ')}\n`);
  }
} else {
  for (const [file, text] of outputs) writeFileSync(file, text, 'utf8');
  process.stdout.write(`wrote ${outputs.length} files from ${claims.length} claim entries: ${counts.join(', ')}\n`);
}
