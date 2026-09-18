/**
 * kernel/chains.mjs — execution-chain resolution for the kernel.
 *
 * The kernel's chain logic lives here, not in `model/`: it reads the registry's
 * `operators`/`targets` through `model/index.mjs` and turns them into the
 * ordered candidates an orchestrator may launch. `model/` answers "what model";
 * this module answers "which target, in what order".
 */

import {registry, runtimes, normalizeRuntime, canonicalTarget, resolveModel} from '../model/index.mjs';
import {loadConfig} from '../scripts/config.mjs';

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const need = (condition, message) => { if (!condition) throw Error(message); };

export {canonicalTarget};

/** An Orca launch descriptor is either a managed agent or a return-preamble command terminal. */
export const launchAllowed = launch => isPlainObject(launch) && (
  launch.kind === 'managed-agent' ||
  (launch.kind === 'command-terminal' && launch.dispatch === 'return-preamble-and-send' &&
    typeof launch.command === 'string' && launch.command.trim().length > 0)
);

function operatorRoute(skill, op) {
  const operator = registry.operators?.[op];
  need(operator && operator.skill === skill, 'Unknown skill/operator route');
  const role = registry.reasoningOps.includes(op) ? 'reasoning' : 'working';
  const chain = operator.chain ?? registry.skills?.[skill]?.chains?.[role];
  need(Array.isArray(chain) && chain.length, 'Skill/operator chain is missing');
  return { role, chain };
}

/**
 * Return the immutable ordered candidates that an external orchestrator may
 * launch for one operation. Each candidate carries its resolved model and the
 * Orca launch descriptor the host must execute.
 */
export function resolveExecutionChain({ skill = 'starci', op } = {}) {
  const { role, chain } = operatorRoute(skill, op);
  const seen = new Set();
  const candidates = chain.map((target, priority) => {
    need(!seen.has(target), 'Duplicate target in execution chain');
    seen.add(target);

    const route = registry.targets?.[target];
    need(isPlainObject(route), 'Unknown execution target');

    const profileId = route.profiles?.[role];
    need(typeof profileId === 'string' && profileId, `Execution target ${target} has no ${role} profile`);

    const runtime = normalizeRuntime(route.runtime);
    const profiles = runtimes[runtime]?.profiles;
    const selected = profiles?.[profileId];
    need(selected && selected.role === role, 'Execution target role mismatch');
    need(
      isPlainObject(route.orcaLaunch) && launchAllowed(route.orcaLaunch),
      'Automatic Orca chains require a managed agent or a return-preamble command terminal'
    );

    const orcaLaunch = structuredClone(route.orcaLaunch);
    if (orcaLaunch.kind === 'command-terminal' && role === 'reasoning' && orcaLaunch.reasoningCommand) {
      orcaLaunch.command = orcaLaunch.reasoningCommand;
    }
    delete orcaLaunch.reasoningCommand;

    return {
      priority,
      target,
      runtime,
      provider: runtimes[runtime].provider,
      profile: profileId,
      role,
      model: selected.model,
      executionHosts: Array.isArray(route.executionHosts)
        ? [...route.executionHosts]
        : ['orca', 'headless'],
      orcaLaunch,
    };
  });
  return { schema: 'starci/execution-chain@1', skill, op, role, candidates };
}

function inventoryMap(inventory) {
  need(Array.isArray(inventory), 'Observed Orca agent inventory is required');
  const out = new Map();
  for (const item of inventory) {
    const value = typeof item === 'string' ? { runtime: item, status: 'ready' } : item;
    need(
      isPlainObject(value) &&
      typeof value.runtime === 'string' &&
      ['ready', 'unavailable'].includes(value.status),
      'Invalid Orca agent inventory'
    );
    const runtime = normalizeRuntime(value.runtime);
    need(
      Object.hasOwn(runtimes, runtime) && !out.has(runtime),
      'Invalid or duplicate Orca runtime'
    );
    if (value.profiles !== undefined && (!Array.isArray(value.profiles) || value.profiles.some(x => typeof x !== 'string'))) {
      throw Error('Invalid Orca profile inventory');
    }
    out.set(runtime, { ...value, runtime });
  }
  return out;
}

/**
 * Select the first ready candidate. A failed candidate may be skipped only
 * after verified no effects.
 */
export function selectExecutionTarget({
  skill = 'starci',
  op,
  inventory,
  attempts = [],
  config = loadConfig(),
} = {}) {
  const chain = resolveExecutionChain({ skill, op });
  const available = inventoryMap(inventory);
  need(Array.isArray(attempts), 'Invalid execution attempts');

  const attempted = new Map();
  for (const attempt of attempts) {
    const target = typeof attempt?.target === 'string' ? canonicalTarget(attempt.target) : null;
    need(plain(attempt) && target && !attempted.has(target), 'Invalid execution attempt');
    need(
      attempt.effectState === registry.fallback.requiredEffectState,
      'Unsafe fallback after partial or unknown effects'
    );
    need(
      registry.fallback.allowedReasons.includes(attempt.reason),
      'Fallback reason requires reconciliation or user action'
    );
    attempted.set(target, { ...attempt, target });
  }

  const skipped = [];
  for (const candidate of chain.candidates) {
    if (candidate.orcaLaunch?.capacityGate === 'explicit-workflow-quota') {
      skipped.push({ target: candidate.target, reason: 'unavailable' });
      continue;
    }
    if (attempted.has(candidate.target)) {
      skipped.push({ target: candidate.target, reason: attempted.get(candidate.target).reason });
      continue;
    }
    const observed = available.get(candidate.runtime);
    if (!observed || observed.status !== 'ready') {
      skipped.push({ target: candidate.target, reason: 'unavailable' });
      continue;
    }
    if (observed.profiles && !observed.profiles.includes(candidate.profile)) {
      skipped.push({ target: candidate.target, reason: 'unsupported' });
      continue;
    }
    const execution = resolveModel({
      runtime: candidate.runtime,
      op,
      profile: candidate.profile,
      config,
      imageGenerationAvailable: observed.imageGenerationAvailable === true,
    });
    return {
      schema: 'starci/execution-selection@1',
      skill,
      op,
      selected: { ...candidate, ...execution },
      skipped,
      exhausted: false,
    };
  }
  return {
    schema: 'starci/execution-selection@1',
    skill,
    op,
    selected: null,
    skipped,
    exhausted: true,
  };
}
