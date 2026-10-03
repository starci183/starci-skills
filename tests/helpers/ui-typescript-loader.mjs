import { createRequire } from 'node:module';

const uiRoot = new URL('../../ui/src/', import.meta.url).href;
const requireUi = createRequire(new URL('../../ui/package.json', import.meta.url));
const ts = requireUi('typescript');

/** Resolve the extensionless relative imports authored for the UI's bundler. */
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND' || !context.parentURL?.startsWith(uiRoot) || !specifier.startsWith('.')) throw error;
    return nextResolve(`${specifier}.ts`, context);
  }
}

/** Run actual UI modules through their installed compiler, without mocks. */
export async function load(url, context, nextLoad) {
  if (!url.startsWith(uiRoot) || !/\.tsx?$/.test(new URL(url).pathname)) return nextLoad(url, context);
  const loaded = await nextLoad(url, { ...context, format: 'module' });
  const result = ts.transpileModule(String(loaded.source), {
    fileName: new URL(url).pathname,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    reportDiagnostics: true,
  });
  const errors = result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  if (errors.length) throw new Error(ts.formatDiagnostics(errors, { getCanonicalFileName: name => name, getCurrentDirectory: () => '', getNewLine: () => '\n' }));
  return { ...loaded, format: 'module', source: result.outputText };
}
