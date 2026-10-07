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
const SPACING_RX = Object.freeze([
  /^-?gap(?:-[xy])?-(.+)$/,
  /^-?p[xytblrse]?-(.+)$/,
  /^-?m[xytblrse]?-(.+)$/,
  /^-?space-[xy]-(.+)$/,
  /^-?inset(?:-[xy])?-(.+)$/,
  /^-?(?:top|right|bottom|left|start|end)-(.+)$/,
]);
/** Pure layout utilities (no paint): display, flex/grid structure, placement, position, sizing to the track. */
const LAYOUT_CLASS_RX = [
  /^(?:flex|inline-flex|grid|inline-grid|block|inline-block|hidden|contents|isolate|sr-only|not-sr-only)$/,
  /^flex-(?:row|col|row-reverse|col-reverse|wrap|wrap-reverse|nowrap|1|auto|initial|none)$/,
  /^(?:grow|grow-0|shrink|shrink-0)$/, /^basis-(?:\d+\/\d+|full|auto|0)$/,
  /^grid-(?:cols|rows)-(?:\d+|none|subgrid|\[[^\]]+\])$/, /^grid-flow-(?:row|col|dense|row-dense|col-dense)$/,
  /^(?:col|row)-(?:span-(?:\d+|full)|start-\d+|end-\d+|auto)$/, /^order-(?:\d+|first|last|none)$/,
  /^(?:items|justify|content|self|place-items|place-content|place-self|justify-items|justify-self)-[a-z-]+$/,
  /^(?:relative|absolute|static|sticky)$/, /^z-(?:\d+|auto)$/,
  /^(?:w|h|size)-(?:full|auto|0|min|max|fit|screen|dvh|svh|\d+\/\d+|prose|none)$/,
  /^(?:min|max)-(?:w|h)-(?:full|auto|0|min|max|fit|screen|dvh|svh|\d+\/\d+|prose|none)$/,
  /^max-w-(?:xs|sm|md|lg|xl|[2-7]xl)$/, /^overflow-(?:hidden|visible|clip|auto)$/, /^(?:mx|my|m|ms|me)-auto$/,
];

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** How a spacing class with `step` reads: {kind: layout|token|free, rule?}. */
function classifySpacing(bare, step) {
  if (step === 'auto' || step === 'full' || (step === 'px' && /^-?(?:top|right|bottom|left|inset)/.test(bare))) return { kind: 'layout' };
  if (!GRAMMAR_SPACING_STEPS.includes(step)) return { kind: 'free' };
  let family = 'INSET';
  if (/^-?(?:gap|space)/.test(bare)) family = 'GAP';
  else if (/^-?p/.test(bare)) family = 'PADDING';
  else if (/^-?m/.test(bare)) family = 'MARGIN';
  return { kind: 'token', rule: family === 'GAP' || family === 'PADDING' ? `${family}-${SPACING_RULE_OF_STEP[step]}` : null };
}

/** How one class reads: {kind: layout|token|free|paint, rule?}. */
export function classifyClass(token) {
  const bare = String(token).replace(RESPONSIVE, '').replace(/^!/, '');
  let spacing = null;
  for (const pattern of SPACING_RX) {
    spacing = pattern.exec(bare);
    if (spacing) break;
  }
  if (spacing) return classifySpacing(bare, spacing[1]);
  if (LAYOUT_CLASS_RX.some((rx) => rx.test(bare))) return { kind: 'layout' };
  return { kind: 'paint' };
}

/** The rationale decision justifying a free spacing class: a spacing|layout decision naming the class, with a rule id. */
function justifiedBy(cls, rationale) {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`);
  const rx = new RegExp(String.raw`(^|[^\w-])${escaped}($|[^\w-])`);
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

function importedNamesOf(clause, ts, mod, namespaces) {
  const names = [];
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) {
    names.push(bindings.name.text);
    if (GRAMMAR_MODULE_RX.test(mod)) namespaces.add(bindings.name.text);
  }
  if (bindings && ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) if (!element.isTypeOnly) names.push(element.name.text);
  }
  return { names, bindings };
}

function recordDrawImport(mod, names, clause, bindings, ctx) {
  if (!names.length) return;
  if (GRAMMAR_MODULE_RX.test(mod)) for (const name of names) ctx.grammarImports.set(name, mod);
  else if (REACT_MODULES.includes(mod)) for (const name of names) ctx.reactNames.add(name);
  else if (ICON_MODULE_RX.test(mod)) for (const name of names) ctx.iconImports.add(name);
  else if (ASSET_MODULE_RX.test(mod) && clause.name && !bindings) ctx.assetImports.add(clause.name.text);
  else ctx.add(DRAW_IMPORT_OFF_GRAMMAR, ctx.statement, `imports ${names.join(', ')} from ${mod}: a drawing composes only ${GRAMMAR_PACKAGE} (icons from an icon module as a source prop, art as a relative raster import)`);
}

function inspectDrawImport(statement, ts, ctx) {
  if (!ts.isImportDeclaration(statement)) return;
  const mod = statement.moduleSpecifier.text;
  const clause = statement.importClause;
  if (!clause) {
    ctx.add(DRAW_IMPORT_OFF_GRAMMAR, statement, `imports ${mod} for its side effects: a drawing styles nothing itself (the product CSS is draw-render's --css)`);
    return;
  }
  if (clause.isTypeOnly) return;
  const { names, bindings } = importedNamesOf(clause, ts, mod, ctx.namespaces);
  recordDrawImport(mod, names, clause, bindings, { ...ctx, statement });
}

function collectDrawImports(sf, ts, add) {
  const context = { add, grammarImports: new Map(), namespaces: new Set(), iconImports: new Set(), assetImports: new Set(), reactNames: new Set() };
  for (const statement of sf.statements) inspectDrawImport(statement, ts, context);
  return context;
}

function drawIsExported(node, ts) {
  return list(ts.getModifiers?.(node) ?? node.modifiers).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function inspectFunctionDeclaration(statement, ts, context) {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    if (/^[A-Z]/.test(statement.name.text)) context.local.add(statement.name.text);
    if (drawIsExported(statement, ts)) context.exported.push(statement.name.text);
  }
}

function inspectVariableDeclaration(statement, ts, context) {
  if (!ts.isVariableStatement(statement)) return;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;
    if (/^[A-Z]/.test(declaration.name.text) && declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))) context.local.add(declaration.name.text);
    if (drawIsExported(statement, ts)) context.exported.push(declaration.name.text);
  }
}

function inspectExportDeclaration(statement, ts, context) {
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    for (const element of statement.exportClause.elements) context.exported.push(element.name.text);
  }
}

function collectDrawDeclarations(sf, ts) {
  const context = { local: new Set(), exported: [] };
  for (const statement of sf.statements) {
    inspectFunctionDeclaration(statement, ts, context);
    inspectVariableDeclaration(statement, ts, context);
    inspectExportDeclaration(statement, ts, context);
  }
  return context;
}

function checkDrawClassName(attr, owner, ctx) {
  const init = attr.initializer;
  let value = null;
  if (init && ctx.ts.isStringLiteral(init)) value = init.text;
  else if (init && ctx.ts.isJsxExpression(init) && init.expression && (ctx.ts.isStringLiteral(init.expression) || ctx.ts.isNoSubstitutionTemplateLiteral(init.expression))) value = init.expression.text;
  if (value == null) {
    ctx.add(DRAW_RAW_STYLED_HTML, attr, `<${owner}> className is not a string literal: a drawing's classes must be readable to the gate`);
    return;
  }
  for (const token of value.split(/\s+/).filter(Boolean)) {
    const classification = classifyClass(token);
    if (classification.kind === 'paint') {
      ctx.classes.paint.push(token);
      ctx.add(DRAW_RAW_STYLED_HTML, attr, `<${owner} className="${token}"> paints (colour, type, radius, border or shadow) or is not a layout utility: that is a grammar component's job, never raw HTML`);
    } else if (classification.kind === 'free') {
      ctx.classes.free.push(token);
      if (!justifiedBy(token, ctx.rationale)) ctx.add(DRAW_LAYOUT_VALUE_UNJUSTIFIED, attr, `<${owner} className="${token}"> is a free spacing value outside the grammar GAP/PADDING scale (${GRAMMAR_SPACING_STEPS.join(' ')}): justify it in rationale.json (a spacing|layout decision naming ${token} with its rule id) or use a grammar step`);
    } else if (classification.kind === 'token') ctx.classes.token.push(token);
  }
}

function drawTagName(tag, ts, sf) {
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return `${tag.expression.getText(sf)}.${tag.name.text}`;
  return tag.getText(sf);
}

function inspectDrawTag(node, tagNode, ctx) {
  const tag = drawTagName(tagNode, ctx.ts, ctx.sf);
  const intrinsic = ctx.ts.isIdentifier(tagNode) && /^[a-z]/.test(tag);
  if (intrinsic) {
    if (!LAYOUT_ELEMENTS.includes(tag)) ctx.add(DRAW_RAW_STYLED_HTML, node, `<${tag}> is raw HTML: text is Text/Heading, media is Image/MediaFrame, icons are Icon - HTML is for layout only (${LAYOUT_ELEMENTS.join(', ')})`);
    else ctx.layout.push({ tag, line: ctx.lineOf(node) });
  } else if (ctx.ts.isPropertyAccessExpression(tagNode)) {
    const root = tagNode.expression.getText(ctx.sf);
    if (!ctx.namespaces.has(root) && !(ctx.reactNames.has(root) && tagNode.name.text === 'Fragment')) ctx.add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> is not a ${GRAMMAR_PACKAGE} export`);
  } else if (ctx.iconImports.has(tag)) {
    ctx.add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> renders an icon module raw: pass it as the source of Icon, IconTile or IconButton`);
  } else if (!ctx.grammarImports.has(tag) && !ctx.local.has(tag) && !(ctx.reactNames.has(tag) && tag === 'Fragment')) {
    ctx.add(DRAW_OFF_GRAMMAR_COMPONENT, node, `<${tag}> is neither a ${GRAMMAR_PACKAGE} export nor a component of this file`);
  }
  return tag;
}

function inspectDrawAttributes(attributes, tag, ctx) {
  for (const attr of attributes.properties) {
    if (!ctx.ts.isJsxAttribute(attr)) continue;
    const name = attr.name.getText(ctx.sf);
    if (name === 'style') ctx.add(DRAW_RAW_STYLED_HTML, attr, `<${tag} style> hand-styles: layout uses classes on the grammar spacing scale, paint belongs to grammar components`);
    else if (name === 'dangerouslySetInnerHTML') ctx.add(DRAW_RAW_STYLED_HTML, attr, `<${tag} dangerouslySetInnerHTML> injects raw markup`);
    else if (name === 'className') checkDrawClassName(attr, tag, ctx);
  }
}

function visitDrawElement(node, tagNode, attributes, ctx) {
  const tag = inspectDrawTag(node, tagNode, ctx);
  inspectDrawAttributes(attributes, tag, ctx);
}

function walkDrawSource(node, ctx) {
  if (ctx.ts.isJsxElement(node)) visitDrawElement(node.openingElement, node.openingElement.tagName, node.openingElement.attributes, ctx);
  else if (ctx.ts.isJsxSelfClosingElement(node)) visitDrawElement(node, node.tagName, node.attributes, ctx);
  ctx.ts.forEachChild(node, (child) => { walkDrawSource(child, ctx); });
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
  const add = (code, node, detail) => {
    const location = node ? `:${lineOf(node)}` : '';
    findings.push({ code, line: node ? lineOf(node) : null, detail: `${label}${location} ${detail}` });
  };

  // Imports: grammar, react, icon sources, a raster art placeholder; a type-only import is free.
  const { grammarImports, namespaces, iconImports, assetImports, reactNames } = collectDrawImports(sf, ts, add);

  // Components declared in this file (each is walked like the XBase itself) and the exports.
  const { local, exported } = collectDrawDeclarations(sf, ts);
  if (!exported.some((n) => /^[A-Z]\w*Base$/.test(n))) add(DRAW_BASE_SIGNATURE, null, 'exports no <X>Base: the drawn shape is the XBase of the drawing law');

  const layout = [];
  const classes = { token: [], free: [], paint: [] };
  const context = { ts, sf, add, lineOf, grammarImports, namespaces, iconImports, reactNames, local, rationale, layout, classes };
  walkDrawSource(sf, context);
  return { findings, exports: exported, grammarImports, layout, classes, assetImports: [...assetImports] };
}

/** Findings of the fixtures: each one is {state, props, on} (the drawing law's XBase input). */
export function fixtureFindings(fixtures) {
  const out = [];
  for (const { file, value } of fixtures) {
    const label = path.basename(file);
    if (!value || typeof value !== 'object' || Array.isArray(value)) { out.push({ code: DRAW_BASE_SIGNATURE, detail: `${label} is not a props object` }); continue; }
    const keys = Object.keys(value).toSorted(byCodeUnit);
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
    let opening = null;
    if (ts.isJsxElement(node)) { opening = node.openingElement; }
    else if (ts.isJsxSelfClosingElement(node)) { opening = node; }
    if (opening && ts.isIdentifier(opening.tagName) && /^[a-z]/.test(opening.tagName.text)) at.push(opening.tagName.getEnd());
    ts.forEachChild(node, walk);
  };
  walk(sf);
  let out = text;
  for (const pos of at.toSorted((a, b) => b - a)) out = `${out.slice(0, pos)} ${LAYOUT_ATTR}=""${out.slice(pos)}`;
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
  const paths = { ...options.paths };
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

export const typecheckFindings = (result, { label }) => {
  if (result.ok) return [];
  const errors = result.errors.slice(0, 6).map((e) => {
    const file = e.file ? path.basename(e.file) : '';
    const line = e.line ? `:${e.line}` : '';
    return `${file}${line} ${e.code ?? ''} ${e.message}`;
  }).join(' | ');
  return [{ code: DRAW_TYPECHECK_FAILED, detail: `${label} does not type-check against the grammar it renders with (${result.errors.length} error(s)): ${errors}` }];
};

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

const VALUE_FLAGS = new Set(['--fixture', '--product', '--grammar', '--grammar-dist', '--rationale']);

async function main(argv) {
  const json = argv.includes('--json');
  const file = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
  const vals = (k) => argv.flatMap((a, i) => (argv[i - 1] === k ? [a] : []));
  if (!file) { process.stderr.write('use: starci work draw-source <X.draw.tsx> [--fixture <json>]... [--product <app dir>] [--grammar auto|product|claude-dist] [--grammar-dist <package root>] [--rationale <file>] [--json]\n'); return 2; }
  const productDir = path.resolve(vals('--product')[0] ?? path.dirname(file));
  const r = await checkDrawSource({ file: path.resolve(file), fixtures: vals('--fixture').map((f) => path.resolve(f)), productDir, prefer: vals('--grammar')[0] ?? 'auto',
    grammarDist: vals('--grammar-dist')[0] ?? null, rationaleFile: vals('--rationale')[0] ? path.resolve(vals('--rationale')[0]) : undefined });
  const out = { ok: r.findings.length === 0, findings: r.findings, grammar: { ok: r.grammar.ok, grammarSource: r.grammar.grammarSource, upgradeOwed: r.grammar.upgradeOwed,
    attempts: r.grammar.attempts.map((a) => ({ source: a.source, version: a.version, ok: a.ok, errors: a.errors.length })) } };
  if (json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  else {
    const upgrade = r.grammar.upgradeOwed ? ` (product upgrade owed ${r.grammar.upgradeOwed.from} -> ${r.grammar.upgradeOwed.to})` : '';
    const findings = r.findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n');
    process.stdout.write(`${out.ok ? 'ok' : 'REFUSED'}: ${path.basename(file)} grammar ${r.grammar.grammarSource ?? 'unresolved'}${upgrade}\n${findings}\n`);
  }
  return out.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { process.stderr.write(`draw-source: ${e?.stack ?? e}\n`); process.exitCode = 2; }
}
