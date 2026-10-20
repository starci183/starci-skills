// draw-typecheck.mjs — the typecheck half of the interface.draw source gate (draw-source.mjs): type-check one draw file
// against a grammar candidate with the product's typescript. Split out so draw-grammar.mjs, which draw-source.mjs loads,
// never imports the draw-source entry module back.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackage, requirePackage } from '../../lib/package-at.mjs';
import { isFile } from '../../lib/fs-kind.mjs';

export const GRAMMAR_PACKAGE = '@starci/grammar';
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** Ambient declarations every draw file type-checks with (a raster import is its URL, as draw-render's esbuild emits it). */
const DRAW_AMBIENT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'].map((ext) => `declare module "*.${ext}" { const src: string; export default src }\n`).join('');

/** The typescript module: the product's own install, else the runtime's. */
export function loadTypescript(dirs = []) {
  const found = findPackage([...dirs, SKILL_ROOT], ['typescript']);
  if (!found) return null;
  return { ts: requirePackage(found), version: found.version, root: found.root };
}

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
