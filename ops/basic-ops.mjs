import { authorityFor } from './role-authority.mjs';

export const basicIds = ['business.decide', 'architecture.decide', 'interface.draw', 'interface.implement', 'backend.implement', 'uat.verify'];

/** A generated view of the six source contracts, never a second dispatcher. */
export function basicOps(operators) {
  return {
    schema: 'starci/basic-ops@1',
    limits: { sequentialSteps: 3, parallelPrimaries: 3, primarySlots: 9, secondaryDefinitionsPerPrimary: 3 },
    storage: '.starciwork',
    scope: 'Operator-library contracts only; executing a product flow requires its actual accepted scope and bound resources.',
    ops: basicIds.map(id => {
      const op = operators.find(x => x.id === id);
      if (!op) throw Error('Missing basic operator: ' + id);
      return {
        id, goal: op.goal, reads: op.reads, writes: op.writes, steps: op.steps,
        proofs: op.proofs, blockers: op.blockers,
        secondaryCalls: authorityFor(op).primary.calls,
        qualityPolicy: op.qualityPolicy ?? null,
        commitPolicy: op.commitPolicy ?? null,
      };
    }),
    handoffs: [
      { from: 'business.decide', to: 'architecture.decide', output: '.starciwork business node and specification', input: 'declared business refs/dependencies', invariant: 'Preserve selected accepted requirements, acceptance IDs and canonical journeys.' },
      { from: 'business.decide', to: 'interface.draw', output: 'specification.journeys + journeyCoverage', input: 'selected business scope and workflow journeys', invariant: 'Copy canonical journeys; do not infer browser actions from internal service calls.' },
      { from: 'architecture.decide', to: 'interface.implement, backend.implement', output: 'source-independent SDS component, contract, data, runtime and decision IDs', input: 'selected canonical SDS and SRS owners; Implementation resolves source and freezes exact write ceilings', invariant: 'Preserve logical owners and accepted outcomes. Architecture does not map source or grant code writes.' },
      { from: 'interface.draw', to: 'interface.implement', output: 'E/draws.json and actual image assets', input: 'draws[]', invariant: 'All required images are opened, mapped and checked against applicable knowledge.' },
      { from: 'backend.implement', to: 'interface.implement', output: 'scoped support response and actual backend commits', input: 'pending caller-owned secondary job', invariant: 'Only when FE step 4 requests it; all required support criteria pass before FE resumes.' },
      { from: 'interface.implement', to: 'uat.verify', output: 'E/flows.json: flows, codeRefs, runtime', input: 'ordered flows and source/runtime binding', invariant: 'Preserve journey fields; add sourcePaths only. Actual served identity must match the accepted delivery.' },
    ],
    gates: [
      'Required request/response bindings, criteria and actual evidence must pass before handoff.',
      'Draft source observations never become approved business or product acceptance.',
      'Implementation owns quality checks and scoped local commits; it never publishes implicitly.',
      'UAT records real UX and media, executes cleanup in finally, and cannot pass with owned resources unresolved.',
      'AI repair stays in the selected cell and scope; unknown external effects are reconciled before retry.',
    ],
    implementedWorkflows: ['frontend: interface.draw -> interface.implement -> uat.verify'],
    truthLimit: 'Local validation proves structure, reference binding and byte integrity. It does not run product code, authenticate accounts, inspect a real browser, or certify runtime security.',
  };
}
