#!/usr/bin/env node
// draw-source.mjs — owner ruling 2026-09-27 ("locked"): interface.draw DRAWS WITH THE REAL GRAMMAR COMPONENTS. The
// drawer writes each shape as a React `XBase` in `<XBase>.draw.tsx` (the drawing law: the XBase takes {state, props,
// on} of atoms) composing ONLY @starci/grammar components with their real props and
// variants, plus fixture JSON per state (and optionally per viewport); scripts/work/draw-render.mjs --component
// renders it with the product's own CSS. This file is the source gate that runs BEFORE the render:
//
//   DRAW_TYPECHECK_FAILED           TypeScript is the first gate. The draw file is type-checked (the product's own
//                                   typescript and tsconfig, with @starci/grammar mapped to the grammar the draw
//                                   renders against - scripts/work/draw-grammar.mjs) - a prop or a variant the
//                                   grammar does not publish, a missing required prop, a wrong closed value fails.
//                                   A check that cannot run (no typescript, no grammar types) fails too.
//   DRAW_OFF_GRAMMAR_COMPONENT      (AST) a JSX element that is neither a @starci/grammar export, a component
//                                   declared in the same file (itself walked), a React Fragment nor an allowed
//                                   layout element; an icon module used as an element (an icon is a `source` prop of
//                                   Icon/IconTile/IconButton, never rendered raw).
//   DRAW_RAW_STYLED_HTML            (AST) raw HTML imitating a component: an HTML element outside the layout set
//                                   (div, section, article, header, footer, main, aside, nav, ul, ol, li), a `style`
//                                   or dangerouslySetInnerHTML, a className that is not a string literal, or a class
//                                   that paints (bg-*, text-*, font-*, rounded-*, border*, shadow*, ring* ...) rather
//                                   than lays out (flex/grid/gap/padding/order/span/position ...). The same class law
//                                   applies to a className handed to a grammar component (PageContainer,
//                                   DescriptionList, MediaFrame ... accept one for placement only).
//   DRAW_IMPORT_OFF_GRAMMAR         (AST) a value import from anything but @starci/grammar[/<family>], react and the
//                                   icon modules (@heroicons/react/*, lucide-react, @spectrum-icons/*). A type-only
//                                   import is free.
//   DRAW_LAYOUT_VALUE_UNJUSTIFIED   (AST) a free spacing value - a Tailwind gap/padding/margin/space step outside the
//                                   grammar GAP/PADDING scale (0 1 2 3 4 6 8: knowledge/ui/presentation gap.yaml,
//                                   padding.yaml) or an arbitrary [..] value - that no rationale.json decision of kind
//                                   spacing|layout names with a rule id (the rationale evidence of lane
//                                   draw-devin-rationale).
//   DRAW_BASE_SIGNATURE             the file exports no `<X>Base`, or a fixture is not {state, props, on} (the
//                                   drawing law: every XBase takes exactly those three).
//
// Rendered-DOM ownership (draw-render.mjs measures it, record `ownership`): every element that paints must sit in a
// grammar component (data-component, a data-grammar-* hook or a starci-core-* class nearer than any drawn layout
// element) - reported as DRAW_OFF_GRAMMAR_COMPONENT against the rendered DOM.
//
//   starci work draw-source <X.draw.tsx> [--fixture <json>]... [--product <app dir>]
//        [--grammar auto|product|claude-dist] [--grammar-dist <package root>] [--rationale <file>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { list, byCodeUnit } from '../../lib/list.mjs';
import { isFile } from '../../lib/fs-kind.mjs';
import { DRAW_OFF_GRAMMAR_COMPONENT } from './draw-dna.mjs';
import { isMain } from '../../lib/is-main.mjs';

export { DRAW_OFF_GRAMMAR_COMPONENT };
export const DRAW_TYPECHECK_FAILED = 'DRAW_TYPECHECK_FAILED';
export const DRAW_RAW_STYLED_HTML = 'DRAW_RAW_STYLED_HTML';
export const DRAW_IMPORT_OFF_GRAMMAR = 'DRAW_IMPORT_OFF_GRAMMAR';
export const DRAW_LAYOUT_VALUE_UNJUSTIFIED = 'DRAW_LAYOUT_VALUE_UNJUSTIFIED';
export const DRAW_BASE_SIGNATURE = 'DRAW_BASE_SIGNATURE';

export const DRAW_SOURCE_SUFFIX = '.draw.tsx';
export const GRAMMAR_PACKAGE = '@starci/grammar';
const GRAMMAR_MODULE_RX = /^@starci\/grammar(?:\/[a-z][a-z-]*)?$/;
const ICON_MODULE_RX = /^(?:@heroicons\/react\/[\w/-]+|lucide-react|@spectrum-icons\/[\w/-]+)$/;
const REACT_MODULES = Object.freeze(['react']);
/** A relative raster import: the art-slot placeholder of a MediaFrame/Image (data-asset-slot; interface.asset owes the art). */
const ASSET_MODULE_RX = /^\.{1,2}\/[^?#]+\.(?:png|jpe?g|webp|gif|avif)$/i;
/** Ambient declarations every draw file type-checks with (a raster import is its URL, as draw-render's esbuild emits it). */
const DRAW_AMBIENT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].map((ext) => `declare module "*.${ext}" { const src: string; export default src }\n`).join('');
/** HTML a drawing may use, for layout only (grid, region order, list semantics). */
const LAYOUT_ELEMENTS = Object.freeze(['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'ul', 'ol', 'li']);
/** The attribute draw-render stamps on every layout element of a draw file (rendered-DOM ownership). */
export const LAYOUT_ATTR = 'data-draw-layout';
/** Tailwind steps the grammar spacing scale publishes (GAP-0..6 / PADDING-0..6: 0 .25 .5 .75 1 1.5 2 rem). */
const GRAMMAR_SPACING_STEPS = Object.freeze(['0', '1', '2', '3', '4', '6', '8']);
const SPACING_RULE_OF_STEP = Object.freeze({ 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 6: 5, 8: 6 });

const RESPONSIVE = /^(?:(?:sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|@[a-z0-9]+|motion-reduce|print):)*/;
const SPACING_RX = /^-?(?:gap(?:-[xy])?|p[xytblrse]?|m[xytblrse]?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left|start|end)-(.+)$/;
/** Pure layout utilities (no paint): display, flex/grid structure, placement, position, sizing to the track. */
const LAYOUT_CLASS_RX = [
  /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|hidden|contents|isolate|sr-only|not-sr-only)$/,
  /^flex-(?:row|col|row-reverse|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none)$/,
  /^(?:grow|grow-0|shrink|shrink-0)$/, /^basis-(?:\d+\/\d+|full|auto|0)$/,
  /^grid-(?:cols|rows)-(?:\d+|none|subgrid|\[[^\]]+\])$/, /^grid-flow-(?:row|col|dense|row-dense|col-dense)$/,
  /^(?:col|row)-(?:span-(?:\d+|full)|start-\d+|end-\d+|auto)$/, /^order-(?:\d+|first|last|none)$/,
  /^(?:items|justify|content|self|place-items|place-content|place-self|justify-items|justify-self)-[a-z-]+$/,
  /^(?:relative|absolute|static|sticky)$/, /^z-(?:\d+|auto)$/,
  /^(?:w|h|min-w|min-h|max-w|max-h|size)-(?:full|auto|0|min|max|fit|screen|dvh|svh|\d+\/\d+|prose|none)$/,
  /^max-w-(?:xs|sm|md|lg|xl|[2-7]xl)$/, /^overflow-(?:hidden|visible|clip|auto)$/, /^(?:mx|my|m|ms|me)-auto$/,
];

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** How one class reads: {kind: layout|token|free|paint, rule?}. */
export function classifyClass(token) {
  const bare = String(token).replace(RESPONSIVE, '').replace(/^!/, '');
  const spacing = SPACING_RX.exec(bare);
  if (spacing) {
    const step = spacing[1];
    if (step === 'auto' || step === 'full' || (step === 'px' && /^-?(?:top|right|bottom|left|inset)/.test(bare))) return { kind: 'layout' };
    if (GRAMMAR_SPACING_STEPS.includes(step)) {
      const family = /^-?(?:gap|space)/.test(bare) ? 'GAP' : /^-?p/.test(bare) ? 'PADDING' : /^-?m/.test(bare) ? 'MARGIN' : 'INSET';
      return { kind: 'token', rule: family === 'GAP' || family === 'PADDING' ? `${family}-${SPACING_RULE_OF_STEP[step]}` : null };
    }
    return { kind: 'free' };
  }
  if (LAYOUT_CLASS_RX.some((rx) => rx.test(bare))) return { kind: 'layout' };
  return { kind: 'paint' };
}

/** The rationale decision justifying a free spacing class: a spacing|layout decision naming the class, with a rule id. */
function justifiedBy(cls, rationale) {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const rx = new RegExp(`(^|[^\\w-])${escaped}($|[^\\w-])`);
  return list(rationale).find((e) => ['spacing', 'layout'].includes(e?.kind) && list(e.rules).some((r) => String(r).trim())
    && rx.test(`${e.value ?? ''} ${e.decision ?? ''}`)) ?? null;
}

/** The typescript module: the product's own install, else the runtime's. */
export function loadTypescript(dirs = []) {
  const found = findPackage([...dirs, SKILL_ROOT], ['typescript']);
  if (!found) return null;
  return { ts: requirePackage(found), version: found.version, root: found.root };
}

/** The rationale.json beside a draw file: <stem>.rationale.json, <XBase>.rationale.json, else rationale.json. */
export function rationaleFileFor(file) {
  const dir = path.dirname(file), base = path.basename(file);
  const stems = [base.replace(/\.tsx$/i, ''), base.replace(/\.draw\.tsx$/i, '')];
  return [...stems.map((s) => path.join(dir, `${s}.rationale.json`)), path.join(dir, 'rationale.json')].find(isFile) ?? null;
}

function loadRationaleEntries(file) {
  if (!file) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(doc) ? doc : list(doc?.entries ?? doc?.decisions);
  } catch { return []; }
}

/**
 * The AST gate of one draw file's text. Returns {findings:[{code, detail, line}], exports:[names], grammarImports,
 * layout:[{tag, line}], classes:{token, free, paint}}.
 */
export function sourceFindings(text, { file = 'source.draw.tsx', rationale = [], ts = loadTypescript()?.ts } = {}) {
  if (!ts) return { findings: [{ code: DRAW_TYPECHECK_FAILED, detail: `${path.basename(file)}: no typescript install to parse the draw source` }], exports: [], grammarImports: new Map(), layout: [], classes: { token: [], free: [], paint: [] } };
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const label = path.basename(file);
  const findings = [];
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
  const add = (code, node, detail) => findings.push({ code, line: node ? lineOf(node) : null, detail: `${label}${node ? `:${lineOf(node)}` : ''} ${detail}` });

  // Imports: grammar, react, icon sources, a raster art placeholder; a type-only import is free.
  const grammarImports = new Map(); // local name -> module
  const namespaces = new Set();
  const iconImports = new Set();
  const assetImports = new Set();
  const reactNames = new Set();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st)) continue;
    const mod = st.moduleSpecifier.text;
    const clause = st.importClause;
    if (!clause) { add(DRAW_IMPORT_OFF_GRAMMAR, st, `imports ${mod} for its side effects: a drawing styles nothing itself (the product CSS is draw-render's --css)`); continue; }
    if (clause.isTypeOnly) continue;
    const names = [];
    if (clause.name) names.push(clause.name.text);
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) { names.push(nb.name.text); if (GRAMMAR_MODULE_RX.test(mod)) namespaces.add(nb.name.text); }
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) if (!el.isTypeOnly) names.push(el.name.text);
    if (!names.length) continue;
    if (GRAMMAR_MODULE_RX.test(mod)) for (const n of names) grammarImports.set(n, mod);
    else if (REACT_MODULES.includes(mod)) for (const n of names) reactNames.add(n);
    else if (ICON_MODULE_RX.test(mod)) for (const n of names) iconImports.add(n);
    else if (ASSET_MODULE_RX.test(mod) && clause.name && !nb) assetImports.add(clause.name.text);
    else add(DRAW_IMPORT_OFF_GRAMMAR, st, `imports ${names.join(', ')} from ${mod}: a drawing composes only ${GRAMMAR_PACKAGE} (icons from an icon module as a source prop, art as a relative raster import)`);
  }

  // Components declared in this file (each is walked like the XBase itself) and the exports.
  const local = new Set();
  const exported = [];
  const isExported = (node) => list(ts.getModifiers?.(node) ?? node.modifiers).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) { if (/^[A-Z]/.test(st.name.text)) local.add(st.name.text); if (isExported(st)) exported.push(st.name.text); }
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue;
      if (/^[A-Z]/.test(d.name.text) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) local.add(d.name.text);
      if (isExported(st)) exported.push(d.name.text);
    }
    if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) for (const el of st.exportClause.elements) exported.push(el.name.text);
  }
  if (!exported.some((n) => /^[A-Z]\w*Base$/.test(n))) add(DRAW_BASE_SIGNATURE, null, 'exports no <X>Base: the drawn shape is the XBase of the drawing law');

  const layout = [];
  const classes = { token: [], free: [], paint: [] };
  const checkClassName = (attr, owner) => {
    const init = attr.initializer;
    let value = null;
    if (init && ts.isStringLiteral(init)) value = init.text;
    else if (init && ts.isJsxExpression(init) && init.expression && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) value = init.expression.text;
    if (value == null) { add(DRAW_RAW_STYLED_HTML, attr, `<${owner}> className is not a string literal: a drawing's classes must be readable to the gate`); return; }
    for (const token of value.split(/\s+/).filter(Boolean)) {
      const c = classifyClass(token);
      if (c.kind === 'paint') { classes.paint.push(token); add(DRAW_RAW_STYLED_HTML, attr, `<${owner} className="${token}"> paints (colour, type, radius, border or shadow) or is not a layout utility: that is a grammar component's job, never raw HTML`); }
      else if (c.kind === 'free') {
        classes.free.push(token);
        if (!justifiedBy(token, rationale)) add(DRAW_LAYOUT_VALUE_UNJUSTIFIED, attr, `<${owner} className="${token}"> is a free spacing value outside the grammar GAP/PADDING scale (${GRAMMAR_SPACING_STEPS.join(' ')}): justify it in rationale.json (a spacing|layout decision naming ${token} with its rule id) or use a grammar step`);
      } else if (c.kind === 'token') classes.token.push(token);
    }
  };
  const tagName = (t) => (ts.isIdentifier(t) ? t.text : ts.isPropertyAccessExpression(t) ? `${t.expression.getText(sf)}.${t.name.text}` : t.getText(sf));
  const visitElement = (node, tagNode, attributes) => {
    const tag = tagName(tagNode);
    const intrinsic = ts.isIdentifier(tagNode) && /^[a-z]/.test(tag);
    if (intrinsic) {
      if (!LAYOUT_ELEMENTS.includes(tag)) add(DRAW_RAW_STYLED_HTML, node, `<${tag}> is raw HTML: text is Text/Heading, media is Image/MediaFrame, icons are Icon - HTML is for layout only (${LAYOUT_ELEMENTS.join(', ')})`);
      else layout.push({ tag, line: lineOf(node) });
    } else if (ts.isPropertyAccessExpression(tagNode)) {
      const root = tagNode.expression.getText(sf);
      if (!namespaces.has(root) && !(reactNames.has(root) && tagNode.name.text === 'Fragment')) add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> is not a ${GRAMMAR_PACKAGE} export`);
    } else if (iconImports.has(tag)) {
      add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> renders an icon module raw: pass it as the source of Icon, IconTile or IconButton`);
    } else if (!grammarImports.has(tag) && !local.has(tag) && !(reactNames.has(tag) && tag === 'Fragment')) {
      add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> is neither a ${GRAMMAR_PACKAGE} export nor a component of this file`);
    }
    for (const attr of attributes.properties) {
      if (!ts.isJsxAttribute(attr)) continue;
      const name = attr.name.getText(sf);
      if (name === 'style') add(DRAW_RAW_STYLED_HTML, attr, `<${tag} style> hand-styles: layout uses classes on the grammar spacing scale, paint belongs to grammar components`);
      else if (name === 'dangerouslySetInnerHTML') add(DRAW_RAW_STYLED_HTML, attr, `<${tag} dangerouslySetInnerHTML> injects raw markup`);
      else if (name === 'className') checkClassName(attr, tag);
    }
  };
  const walk = (node) => {
    if (ts.isJsxElement(node)) visitElement(node.openingElement, node.openingElement.tagName, node.openingElement.attributes);
    else if (ts.isJsxSelfClosingElement(node)) visitElement(node, node.tagName, node.attributes);
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return { findings, exports: exported, grammarImports, layout, classes, assetImports: [...assetImports] };
}

/** Findings of the fixtures: each one is {state, props, on} (the drawing law's XBase input). */
export function fixtureFindings(fixtures) {
  const out = [];
  for (const { file, value } of fixtures) {
    const label = path.basename(file);
    if (!value || typeof value !== 'object' || Array.isArray(value)) { out.push({ code: DRAW_BASE_SIGNATURE, detail: `${label} is not a props object` }); continue; }
    const keys = Object.keys(value).sort(byCodeUnit);
    if (keys.join(',') !== 'on,props,state') out.push({ code: DRAW_BASE_SIGNATURE, detail: `${label} holds {${keys.join(', ')}}: an XBase fixture is exactly {state, props, on} (the drawing law)` });
    else if (typeof value.state !== 'string') out.push({ code: DRAW_BASE_SIGNATURE, detail: `${label} state is not a shape name` });
  }
  return out;
}

/** Insert `data-draw-layout=""` into every intrinsic element of a draw file, for the rendered-DOM ownership probe. */
export function markLayoutElements(text, { ts = loadTypescript()?.ts, file = 'source.draw.tsx' } = {}) {
  if (!ts) return text;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = [];
  const walk = (node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && ts.isIdentifier(opening.tagName) && /^[a-z]/.test(opening.tagName.text)) at.push(opening.tagName.getEnd());
    ts.forEachChild(node, walk);
  };
  walk(sf);
  let out = text;
  for (const pos of at.sort((a, b) => b - a)) out = `${out.slice(0, pos)} ${LAYOUT_ATTR}=""${out.slice(pos)}`;
  return out;
}

/* ------------------------------------------------------------------ typecheck */

const nodeModulesUp = (dir) => {
  const out = [];
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const nm = path.join(d, 'node_modules');
    if (fs.existsSync(nm)) out.push(nm);
    if (path.dirname(d) === d) break;
  }
  return out;
};

/**
 * Type-check one draw file against the grammar at `grammarRoot` (a package root holding dist/<family>/index.d.ts),
 * with the product's typescript and compiler options. Every bare import resolves from the product's node_modules, so
 * the draw file may live anywhere (a temp or ui-record dir). Returns {ok, errors:[{file, line, code, message}], typescript}.
 */
export function typecheckDraw({ file, productDir, grammarRoot, ts: tsIn = null }) {
  const loaded = tsIn ? { ts: tsIn, version: tsIn.version } : loadTypescript([productDir]);
  if (!loaded) return { ok: false, errors: [{ file, line: null, code: 'no-typescript', message: `no typescript resolvable from ${productDir}` }], typescript: null };
  const { ts } = loaded;
  let options = { strict: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2020,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.esnext.d.ts'], skipLibCheck: true, esModuleInterop: true, isolatedModules: true, resolveJsonModule: true };
  const tsconfig = path.join(productDir, 'tsconfig.json');
  if (isFile(tsconfig)) {
    const read = ts.readConfigFile(tsconfig, ts.sys.readFile);
    if (!read.error) options = ts.parseJsonConfigFileContent(read.config, ts.sys, productDir, undefined, tsconfig).options;
  }
  const modules = nodeModulesUp(productDir);
  const paths = { ...(options.paths ?? {}) };
  const base = options.pathsBasePath ?? options.baseUrl ?? productDir;
  for (const [k, v] of Object.entries(paths)) paths[k] = v.map((p) => path.resolve(base, p));
  const gRoot = path.resolve(grammarRoot);
  paths[GRAMMAR_PACKAGE] = [path.join(gRoot, 'dist', 'core', 'index.d.ts')];
  paths[`${GRAMMAR_PACKAGE}/*`] = [path.join(gRoot, 'dist', '*', 'index.d.ts')];
  paths['*'] = [...modules.map((m) => path.join(m, '@types', '*')), ...modules.map((m) => path.join(m, '*'))];
  const opts = { ...options, paths, baseUrl: undefined, pathsBasePath: productDir, noEmit: true, incremental: false, composite: false, tsBuildInfoFile: undefined, plugins: undefined,
    skipLibCheck: true, types: [], typeRoots: modules.map((m) => path.join(m, '@types')) };
  const ambient = path.join(path.dirname(path.resolve(file)), '__starci-draw-ambient.d.ts');
  const host = ts.createCompilerHost(opts);
  const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (f) => same(f, ambient) || fileExists.call(host, f);
  host.readFile = (f) => (same(f, ambient) ? DRAW_AMBIENT : readFile.call(host, f));
  host.getSourceFile = (f, lang, ...rest) => (same(f, ambient) ? ts.createSourceFile(f, DRAW_AMBIENT, lang) : getSourceFile.call(host, f, lang, ...rest));
  const program = ts.createProgram({ rootNames: [path.resolve(file), ambient], options: opts, host });
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error);
  const errors = diagnostics.map((d) => {
    const pos = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    return { file: d.file ? d.file.fileName : null, line: pos ? pos.line + 1 : null, code: `TS${d.code}`, message: ts.flattenDiagnosticMessageText(d.messageText, ' ').slice(0, 600) };
  });
  return { ok: errors.length === 0, errors, typescript: loaded.version ?? ts.version };
}

export const typecheckFindings = (result, { label }) => (result.ok ? [] : [{ code: DRAW_TYPECHECK_FAILED,
  detail: `${label} does not type-check against the grammar it renders with (${result.errors.length} error(s)): ${result.errors.slice(0, 6).map((e) => `${e.file ? path.basename(e.file) : ''}${e.line ? `:${e.line}` : ''} ${e.code ?? ''} ${e.message}`).join(' | ')}` }]);

/**
 * The whole source gate of one draw file: grammar resolution (typecheck-driven, draw-grammar.mjs), then the AST gate
 * and the fixtures. Returns {findings, grammar (the resolution record), ast, rationale}.
 */
export async function checkDrawSource({ file, fixtures = [], productDir, skillRoot = SKILL_ROOT, grammarDist = null, prefer = 'auto', rationaleFile = undefined, typecheck = undefined }) {
  const { resolveDrawGrammar } = await import('../draw-grammar.mjs');
  const text = fs.readFileSync(file, 'utf8');
  const label = path.basename(file);
  const why = rationaleFile === undefined ? rationaleFileFor(file) : rationaleFile;
  const ts = loadTypescript([productDir])?.ts;
  const ast = sourceFindings(text, { file, rationale: loadRationaleEntries(why), ts });
  const grammar = resolveDrawGrammar({ file, productDir, skillRoot, grammarDist, prefer, ...(typecheck ? { typecheck } : {}) });
  const failed = grammar.attempts.at(-1) ?? { ok: false, errors: [{ message: grammar.error ?? 'no grammar candidate' }] };
  const findings = [...(grammar.ok ? [] : typecheckFindings(failed, { label })),
    ...ast.findings.map(({ code, detail }) => ({ code, detail })),
    ...fixtureFindings(fixtures.map((f) => ({ file: f, value: (() => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } })() })))];
  return { findings, grammar, ast: { exports: ast.exports, layout: ast.layout, classes: ast.classes, grammarImports: Object.fromEntries(ast.grammarImports ?? []) }, rationale: why };
}

/* ------------------------------------------------------------------------ CLI */

const VALUE_FLAGS = ['--fixture', '--product', '--grammar', '--grammar-dist', '--rationale'];

async function main(argv) {
  const json = argv.includes('--json');
  const file = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(argv[i - 1]));
  const vals = (k) => argv.flatMap((a, i) => (argv[i - 1] === k ? [a] : []));
  if (!file) { process.stderr.write('use: starci work draw-source <X.draw.tsx> [--fixture <json>]... [--product <app dir>] [--grammar auto|product|claude-dist] [--grammar-dist <package root>] [--rationale <file>] [--json]\n'); return 2; }
  const productDir = path.resolve(vals('--product')[0] ?? path.dirname(file));
  const r = await checkDrawSource({ file: path.resolve(file), fixtures: vals('--fixture').map((f) => path.resolve(f)), productDir, prefer: vals('--grammar')[0] ?? 'auto',
    grammarDist: vals('--grammar-dist')[0] ?? null, rationaleFile: vals('--rationale')[0] ? path.resolve(vals('--rationale')[0]) : undefined });
  const out = { ok: r.findings.length === 0, findings: r.findings, grammar: { ok: r.grammar.ok, grammarSource: r.grammar.grammarSource, upgradeOwed: r.grammar.upgradeOwed,
    attempts: r.grammar.attempts.map((a) => ({ source: a.source, version: a.version, ok: a.ok, errors: a.errors.length })) } };
  if (json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  else process.stdout.write(`${out.ok ? 'ok' : 'REFUSED'}: ${path.basename(file)} grammar ${r.grammar.grammarSource ?? 'unresolved'}${r.grammar.upgradeOwed ? ` (product upgrade owed ${r.grammar.upgradeOwed.from} -> ${r.grammar.upgradeOwed.to})` : ''}\n${r.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}\n`);
  return out.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { process.stderr.write(`draw-source: ${e?.stack ?? e}\n`); process.exitCode = 2; });
}
