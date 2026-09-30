/**
 * The compiler options both emit workers use: the repository's own tsconfig.json, made emit-safe, with the two decorator switches
 * Nest needs. A configuration that cannot be read completely (an `extends` package that is not installed here) falls back to what
 * a Nest project compiles with, and each problem is handed to `note` so the caller can report it like a stand-in.
 */
import path from 'node:path';

/** Answers the compiler options of the repository at `repoRoot`. */
export function compilerOptionsOf(ts, repoRoot, note = () => {}) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    path.join(repoRoot, 'tsconfig.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (diagnostic) => { throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')); } },
  );
  for (const error of parsed.errors) note(`tsconfig.json (${ts.flattenDiagnosticMessageText(error.messageText, ' ')}): compiler options fall back to the Nest defaults`);
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    ...parsed.options,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    inlineSourceMap: false,
    incremental: false,
    composite: false,
    tsBuildInfoFile: undefined,
    noEmit: false,
    noEmitOnError: false,
    outDir: undefined,
    rootDir: undefined,
  };
}
