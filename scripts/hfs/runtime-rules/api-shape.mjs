// api-shape.mjs - RT_API_SHAPE (knowledge/hfs/rules.yaml, gate runtime): the api tier is one folder per external system,
// scripts/api/<system>/, holding its lib.mjs runner and one file per call.
//   a call file   exports exactly one function, named in camelCase after the file (worker-start.mjs -> workerStart)
//   lib.mjs       is imported only by the files of its own system
//   no crossing   a file of one api system imports no file of another system (a domain composes two systems)
//   contract      a system with a calls contract (ruleParams.runtime.apiContracts) has a call file only for a call id the
//                 contract declares under `calls:`
// Which files are api files, and of which system, comes from the slot (tier api, the <system> its slot binds). Pure.
import path from 'node:path';
import { parseYaml } from '../../../engine/yaml.mjs';
import { exportedNames, relativeImportTargets } from './source-ast.mjs';
import { ownerIdOf } from './external-owner.mjs';

export const CODE = 'RT_API_SHAPE';
export const RUNNER = 'lib.mjs';

/** worker-start -> workerStart. */
export const callFunctionName = (stem) => stem.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** The RT_API_SHAPE finding of one call file's exports, or null. */
export function callExportFinding(file, source) {
  const stem = path.posix.basename(file).replace(/\.[cm]?js$/, '');
  const expected = callFunctionName(stem);
  const exported = exportedNames(source);
  const fn = exported.find((e) => e.name === expected && e.fn);
  if (exported.length === 1 && fn) return null;
  const others = exported.filter((e) => e !== fn).map((e) => e.name);
  const what = !fn ? `exports no function ${expected}` : `exports ${others.join(', ')} beside ${expected}`;
  return { code: CODE, level: 'error', path: file, line: (exported[0]?.line ?? 1), message: `${file} ${what}: a call file exports exactly one call function named after the file (${expected}); a constant or a second call is its own call file or lives in the system's lib.mjs` };
}

/** The call ids of a calls contract text (the keys of its `calls:` map). */
export const contractCallIds = (text) => new Set(Object.keys(parseYaml(String(text))?.calls ?? {}));

function apiContractsOf(ctx) {
  const contracts = new Map();
  for (const [system, file] of Object.entries(ctx.params.apiContracts)) {
    const text = ctx.read(file);
    contracts.set(`api/${system}`, { file, ids: text === null ? null : contractCallIds(text) });
  }
  return contracts;
}

function apiCallFileFindings(ctx, file, owner, contracts) {
  if (!owner || ctx.resolver.tierOf(file) !== 'api' || path.posix.basename(file) === RUNNER) return [];
  const found = [];
  const shape = callExportFinding(file, ctx.parsed(file));
  if (shape) found.push(shape);
  const contract = contracts.get(owner);
  const stem = path.posix.basename(file).replace(/\.[cm]?js$/, '');
  if (contract?.ids === null) found.push({ code: CODE, level: 'error', path: contract.file, line: 1, message: `${contract.file}, the calls contract of ${owner}, cannot be read` });
  else if (contract?.ids.has(stem) === false) found.push({ code: CODE, level: 'error', path: file, line: 1, message: `${file} is not a call of ${contract.file}: a call file of ${owner} is named after the call id it wraps (${stem} is no id under calls:)` });
  return found;
}

function apiImportFindings(ctx, file, owner) {
  const found = [];
  for (const ref of relativeImportTargets(ctx, file)) {
    const { to } = ref;
    if (ref.missing) found.push({ code: CODE, level: 'error', path: file, line: ref.line, column: ref.column, message: `${file}:${ref.line} imports missing internal target ${to} (${ref.specifier}): its API custody cannot be judged` });
    if (!ref.tracked) continue;
    const target = ownerIdOf(ctx.resolver, to);
    if (!target || ctx.resolver.tierOf(to) !== 'api' || target === owner) continue;
    if (owner && ctx.resolver.tierOf(file) === 'api') {
      found.push({ code: CODE, level: 'error', path: file, line: ref.line, message: `${file}:${ref.line} (${owner}) imports ${to} of ${target}: an api system never imports another; compose the two calls in the domain module that needs both` });
    } else if (path.posix.basename(to) === RUNNER) {
      found.push({ code: CODE, level: 'error', path: file, line: ref.line, message: `${file}:${ref.line} imports ${to}, the runner of ${target}: only ${target}'s own call files import it - call the call file instead` });
    }
  }
  return found;
}

/** RT_API_SHAPE over the runtime (ctx of scripts/hfs/runtime-check.mjs). */
export function apiShapeFindings(ctx) {
  const found = [];
  const contracts = apiContractsOf(ctx);
  for (const { path: file } of ctx.sources) {
    const owner = ownerIdOf(ctx.resolver, file);
    found.push(...apiCallFileFindings(ctx, file, owner, contracts), ...apiImportFindings(ctx, file, owner));
  }
  return found;
}
