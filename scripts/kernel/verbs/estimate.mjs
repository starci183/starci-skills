// api estimate: split from cli.mjs.
import { normalizeOwnedPaths } from '../../../engine/admission.mjs';
import { defaultParallelGear, loadConfig } from '../../../engine/config.mjs';
import { agentsFor, countsOf, sizeOf, slicingContract } from '../../work/slice-estimate.mjs';
import { csvList } from './shared/rows.mjs';

export default {
  verb: 'estimate',
  required: [],
  usageInCore: true,
    run({ ledger, args, emit, internals }) {
    const contract = slicingContract();
    const { weights, target, maxSlices, gears } = contract;
    const counts = countsOf(args);
    const { minutes, size } = sizeOf(counts, contract);

    // --gear is a dry run: the owner's config.yaml parallel.gear is the standing
    // answer and is never written by this command.
    const gearSource = args.gear !== undefined ? 'flag' : 'config';
    let gear;
    if (gearSource === 'flag') {
      gear = Number(args.gear);
      if (!Number.isInteger(gear) || !gears.includes(gear)) {
        throw Object.assign(
          new Error(`--gear ${args.gear} is not declared by modules/models/runtimes.yaml allocation.slicing.gears (known: ${gears.join(', ')})`),
          { code: 'gear-undeclared' });
      }
    } else {
      gear = loadConfig(internals.ownerRoot)?.parallel?.gear ?? defaultParallelGear();
    }
    const agentsRequested = agentsFor(size, gear, contract);

    // The seam-first partition itself is derived by the Kernel agent from
    // repository evidence (driver-loop.yaml cutExecution), not by this code, so
    // what is computable here is an UPPER BOUND: the pairwise-disjoint concrete
    // prefixes the declared closure already holds. Without --paths there is no
    // closure to bound it with and the request stands unbounded.
    const pathArg = args.paths === undefined ? null : csvList(args.paths);
    let pathGroups = null;
    if (pathArg) {
      try { pathGroups = normalizeOwnedPaths(pathArg); }
      catch (e) { throw Object.assign(new Error(`--paths: ${e.message}`), { code: 'estimate-paths-invalid' }); }
      if (!pathGroups.length) {
        throw Object.assign(new Error('--paths resolved to no concrete prefix'), { code: 'estimate-paths-invalid' });
      }
    }
    const achievableBasis = pathGroups ? 'disjoint-owned-path-prefixes' : 'unbounded-no-path-closure';
    const bounds = [agentsRequested, maxSlices, ...(pathGroups ? [pathGroups.length] : [])];
    const agentsAchievable = Math.max(1, Math.min(...bounds));
    const reason = agentsAchievable < agentsRequested
      ? (pathGroups && pathGroups.length < agentsRequested
        ? `closure partitions into ${pathGroups.length} pairwise-disjoint path prefix(es); size ${size} at gear ${gear} requests ${agentsRequested}`
        : `allocation.slicing.maxSlices ${maxSlices} caps the ${agentsRequested} agents size ${size} requests at gear ${gear}`)
      : null;

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
    emit(out, [
      `estimate: ${minutes} agent-min -> size ${size} at gear ${gear} (${gearSource})`,
      `  agents: requested ${agentsRequested}, achievable ${agentsAchievable} (${achievableBasis})${reason ? ` — ${reason}` : ''}`,
      `  ${slices} slice(s) ~${perSliceMinutes}min each (target ${target[0]}-${target[1]}min, cap ${maxSlices})`,
      // What would actually move the number: a gear only helps while the gear is
      // what bounds the set. Once the partition does, a wider closure decomposition is the only lever.
      ...(out.overTarget ? [`  each slice still exceeds ${target[1]}min — ${reason ? 'decompose the closure into more disjoint prefixes' : 'raise the gear or decompose the closure finer'} before enqueue`] : []),
    ].join('\n'), args.json);
    },
};
