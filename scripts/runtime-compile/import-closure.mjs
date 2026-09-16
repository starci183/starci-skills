import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ownFile = fileURLToPath(import.meta.url);

/** Parse static ES module dependencies with Node's own parser, without linking or evaluating code. */
export function inspectStaticImports(entries) {
  if (typeof vm.SourceTextModule !== 'function') throw Error('Static module inspection requires the isolated Node VM module flag.');
  return entries.map(([name, source]) => {
    const module = new vm.SourceTextModule(source, { identifier: name });
    const specifiers = module.moduleRequests
      ? module.moduleRequests.map(request => request.specifier)
      : module.dependencySpecifiers;
    return [name, [...specifiers]];
  });
}

/** Fail build if the compiled payload omits a statically imported/re-exported relative module. */
export function assertRuntimeImportClosure(files) {
  const entries = [...files].filter(([name]) => name.endsWith('.mjs')).map(([name, bytes]) => [name, bytes.toString('utf8')]);
  if (!entries.length) return;
  // A subprocess enables the parser API without changing the caller's flags or executing payload modules.
  const result = spawnSync(process.execPath, ['--experimental-vm-modules', ownFile, '--inspect-static'], {
    input: JSON.stringify(entries), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
  if (result.status !== 0) throw Error(`Runtime module syntax/dependency inspection failed: ${result.error?.message ?? result.stderr.trim()}`);
  const dependencies = JSON.parse(result.stdout);
  for (const [name, specifiers] of dependencies) for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    let relative;
    try { relative = decodeURIComponent(specifier.split(/[?#]/, 1)[0]); } catch { throw Error(`Invalid relative module URL in ${name}.`); }
    if (relative.includes('\\')) throw Error(`Unsupported relative module separator in ${name}: ${specifier}`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), relative));
    if (target === '..' || target.startsWith('../') || path.posix.isAbsolute(target) || !files.has(target)) {
      throw Error(`Runtime payload is missing static dependency ${name} -> ${specifier} (${target}). Add its owned module to the runtime inventory.`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === ownFile && process.argv[2] === '--inspect-static') {
  try { process.stdout.write(JSON.stringify(inspectStaticImports(JSON.parse(fs.readFileSync(0, 'utf8'))))); }
  catch (error) { process.stderr.write(String(error.message)); process.exitCode = 1; }
}
