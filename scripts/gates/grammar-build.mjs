import path from 'node:path';
import { unlinkNodeModulesLink } from '../api/fs/unlink-node-modules-link.mjs';
import { ci } from '../api/npm/ci.mjs';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { resultDetail, resultOk } from '../lib/verb-call.mjs';
import { grammarDistStatus } from './grammar-dist.mjs';

const BUILD_TIMEOUT_MS = 900_000;
const KNOWLEDGE_TIMEOUT_MS = 180_000;

/** Build this runtime's ignored grammar output and report its source-bound freshness. The caller owns the host lock. */
export function buildGrammar({ root, env = process.env }, deps = {}) {
  const packageRoot = path.join(root, 'packages', 'grammar');
  const fail = (step, detail, extra = {}) => ({ ok: false, step, detail, owed: ['grammar-dist-rebuild'], ...extra });
  try {
    if (!(deps.unlink ?? unlinkNodeModulesLink)(packageRoot)) return fail('npm ci', `cannot unlink ${path.join(packageRoot, 'node_modules')} junction`);
    const install = (deps.ci ?? ci)(packageRoot, { timeout: BUILD_TIMEOUT_MS });
    if (!install?.ok) return fail('npm ci', `exit ${install?.status ?? 'unknown'}${install?.stderr ? ` (${install.stderr.slice(0, 200)})` : ''}`);
    const build = (deps.runNpm ?? runNpm)(['run', 'build'], { cwd: packageRoot, timeout: BUILD_TIMEOUT_MS, env });
    if (!resultOk(build, { acceptOk: false })) return fail('npm run build', `exit ${build?.status ?? 'unknown'}${resultDetail(build) ? ` (${resultDetail(build)})` : ''}`);
    const dist = (deps.grammarDistStatus ?? grammarDistStatus)(packageRoot);
    if (!dist?.ok || dist.state !== 'fresh') return fail('grammar-dist', dist?.detail ?? 'grammar freshness could not be verified', { dist });
    const knowledge = (deps.runNode ?? runNode)([path.join(root, 'scripts', 'work', 'ui', 'grammar-knowledge.mjs')], { cwd: root, timeout: KNOWLEDGE_TIMEOUT_MS, env, maxBuffer: 64 * 1024 * 1024 });
    const freshKnowledge = resultOk(knowledge, { acceptOk: false });
    return { ok: true, state: dist.state, dist, knowledge: freshKnowledge ? 'fresh' : 'owed',
      owed: freshKnowledge ? [] : ['grammar-knowledge-snapshots'],
      ...(freshKnowledge ? {} : { knowledgeDetail: `exit ${knowledge?.status ?? 'unknown'}${resultDetail(knowledge) ? ` (${resultDetail(knowledge)})` : ''}` }) };
  } catch (error) { return fail('exception', String(error?.message ?? error)); }
}
