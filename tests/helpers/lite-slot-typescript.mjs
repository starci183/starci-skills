import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const fixture = fileURLToPath(new URL('../fixtures/hfs-lite-slots/be/', import.meta.url));
const modules = path.join(fixture, 'src/modules');
const websocketDecorators = {
  WebSocketGateway: () => (target) => target,
  WebSocketServer: () => () => undefined,
};

function sourceFile(base) {
  const found = [base, `${base}.ts`, path.join(base, 'index.ts')].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
  if (found === undefined) throw new Error(`Fixture TypeScript module is missing: ${base}`);
  return found;
}

function compileSource(filename) {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
      esModuleInterop: true,
    },
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => fixture,
    getNewLine: () => '\n',
  }));
  return result.outputText;
}

/** Executes the actual fixture source; overrides replace external I/O boundaries for focused proofs. */
export function loadLiteFixture(relative, overrides = {}) {
  const cache = new Map();
  const load = (filename) => {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
      if (specifier === '@nestjs/websockets') return websocketDecorators;
      if (specifier.startsWith('@modules/')) return load(sourceFile(path.join(modules, specifier.slice('@modules/'.length))));
      if (specifier.startsWith('.')) return load(sourceFile(path.resolve(path.dirname(filename), specifier)));
      return require(specifier);
    };
    const evaluate = new Function('require', 'module', 'exports', compileSource(filename));
    evaluate(localRequire, module, module.exports);
    return module.exports;
  };
  return load(sourceFile(path.join(fixture, relative)));
}