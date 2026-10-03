import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLES, GENERATED_DRIFT, driftOfRuntime, syncRuntime } from '../hfs/sync-runtime.mjs';
import { buildGrammar } from '../gates/grammar-build.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCHEMA = 'starci/release-sync-runtime@1';
const USAGE = 'starci release sync-runtime [--check | --prepare-grammar]';

/** Preserve copy synchronization and explicitly prepare grammar before writing copies under the host lock. */
export async function releaseSyncRuntime(ctx, deps = {}) {
  const root = deps.root ?? runtimeRoot;
  const args = ctx?.args ?? {};
  const result = (code, text, extra = {}) => ({ code, text, data: { schema: SCHEMA, ok: code === 0, root, ...extra } });
  if ((ctx?.positionals ?? []).length || (args.check && args['prepare-grammar'])) return result(2, `usage: ${USAGE}`);
  if (args.check) {
    const problems = (deps.driftOfRuntime ?? driftOfRuntime)();
    if (problems.length) return { ...result(1, undefined, { problems }),
      stderr: problems.map((problem) => `${GENERATED_DRIFT} runtime copy drift: ${problem} (run starci release sync-runtime)\n`).join('') };
    return result(0, `OK: ${Object.keys(BUNDLES).length} runtime copies match the runtime`, { problems });
  }
  const operation = () => {
    const grammar = args['prepare-grammar'] ? (deps.buildGrammar ?? buildGrammar)({ root, env: ctx?.env }, deps.grammarDeps) : null;
    if (args['prepare-grammar'] && (!grammar?.ok || grammar.state !== 'fresh' || grammar.knowledge !== 'fresh')) return result(1,
      `grammar preparation failed at ${grammar?.step ?? 'grammar-knowledge'}: ${grammar?.detail ?? grammar?.knowledgeDetail ?? 'fresh grammar and knowledge were not verified'}`, { grammar: grammar ?? null });
    const files = (deps.syncRuntime ?? syncRuntime)();
    return result(0, `${grammar ? 'grammar preparation: fresh; knowledge fresh\n' : ''}runtime copies synced: ${files} files in ${Object.keys(BUNDLES).length} bundles`, { files, grammar });
  };
  try {
    if (!args['prepare-grammar']) return operation();
    const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx?.role ?? 'owner', purpose: 'prepare-grammar', env: ctx?.env }, operation);
    return locked?.ok === true ? locked.value : result(1, `grammar preparation: host lock refused (${locked?.reason ?? 'held'})`, { owner: locked?.owner ?? null });
  } catch (error) { return result(1, `starci release sync-runtime: ${String(error?.message ?? error)}`); }
}
