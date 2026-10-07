// starci kernel estimate: split from cli.mjs.
import { normalizeOwnedPaths } from '../../../engine/admission.mjs';
import { defaultParallelGear, loadConfig } from '../../../engine/config.mjs';
import { agentsFor, countsOf, sizeOf, slicingContract } from '../../work/slice-estimate.mjs';
import { csvList } from './shared/rows.mjs';

const gearOf = (args, gears, ownerRoot) => {
  if (args.gear === undefined) return loadConfig(ownerRoot)?.parallel?.gear ?? defaultParallelGear();
  const gear = Number(args.gear);
  if (!Number.isInteger(gear) || !gears.includes(gear)) {
    throw Object.assign(
      new Error(`--gear ${args.gear} is not declared by modules/models/runtimes.yaml allocation.slicing.gears (known: ${gears.join(', ')})`),
      { code: 'gear-undeclared' });
  }
  return gear;
};

const pathGroupsOf = (args) => {
  const pathArg = args.paths === undefined ? null : csvList(args.paths);
  if (!pathArg) return null;
  let groups;
  try { groups = normalizeOwnedPaths(pathArg); }
  catch (error) { throw Object.assign(new Error(`--paths: ${error.message}`), { code: 'estimate-paths-invalid' }); }
  if (!groups.length) throw Object.assign(new Error('--paths resolved to no concrete prefix'), { code: 'estimate-paths-invalid' });
  return groups;
};

export default {
  verb: 'estimate',
  required: [],
  usageInCore: true,
    run({ ledger, args, emit, internals }) {
    const contract = slicingContract();
    const { weights, target, maxSlices, gears } = contract;
    const counts = countsOf(args);
    const { minutes, size } = sizeOf(counts, contract);

    const gearSource = args.gear !== undefined ? 'flag' : 'config';
    // --gear is a dry run: the owner's config.yaml parallel.gear is the standing
    // answer and is never written by this command.
    const gear = gearOf(args, gears, internals.ownerRoot);
    const agentsRequested = agentsFor(size, gear, contract);

    // The seam-first partition itself is derived by the Kernel agent from
    // repository evidence (driver-loop.yaml cutExecution), not by this code, so
    // what is computable here is an UPPER BOUND: the pairwise-disjoint concrete
    // prefixes the declared closure already holds. Without --paths there is no
    // closure to bound it with and the request stands unbounded.
    const pathGroups = pathGroupsOf(args);
    const achievableBasis = pathGroups ? 'disjoint-owned-path-prefixes' : 'unbounded-no-path-closure';
    const bounds = [agentsRequested, maxSlices, ...(pathGroups ? [pathGroups.length] : [])];
    const agentsAchievable = Math.max(1, Math.min(...bounds));
    let reason = null;
    if (agentsAchievable < agentsRequested) {
      if (pathGroups && pathGroups.length < agentsRequested)
        reason = `closure partitions into ${pathGroups.length} pairwise-disjoint path prefix(es); size ${size} at gear ${gear} requests ${agentsRequested}`;
      else reason = `allocation.slicing.maxSlices ${maxSlices} caps the ${agentsRequested} agents size ${size} requests at gear ${gear}`;
    }

    const slices = agentsAchievable;
    const perSliceMinutes = Math.round((minutes / slices) * 10) / 10;
    const out = {
      ok: true, minutes, size, gear, gearSource,
      agentsRequested, agentsAchievable, achievableBasis, reason,
      ...(pathGroups ? { pathGroups } : {}),
      slices, perSliceMinutes, counts, weights,
      targetMinutes: target, maxSlices, gears,
      overTarget: perSliceMinutes > target[1],
    };
    const reasonNote = reason ? ` — ${reason}` : '';
    emit(out, [
      `estimate: ${minutes} agent-min -> size ${size} at gear ${gear} (${gearSource})`,
      `  agents: requested ${agentsRequested}, achievable ${agentsAchievable} (${achievableBasis})${reasonNote}`,
      `  ${slices} slice(s) ~${perSliceMinutes}min each (target ${target[0]}-${target[1]}min, cap ${maxSlices})`,
      // What would actually move the number: a gear only helps while the gear is
      // what bounds the set. Once the partition does, a wider closure decomposition is the only lever.
      ...(out.overTarget ? [`  each slice still exceeds ${target[1]}min — ${reason ? 'decompose the closure into more disjoint prefixes' : 'raise the gear or decompose the closure finer'} before enqueue`] : []),
    ].join('\n'), args.json);
    },
};
