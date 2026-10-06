// starci kernel peers: split from cli.mjs; output and validation remain stable.
import { verbWorkflow, workflowVerb } from './shared/rows.mjs';
import { currentLegOf, peerMessageOf, peerMessageRows, peerOpenJobsOf, peerWorkflowsOf } from './shared/peer-waits.mjs';
import { dependenciesOf, dependencyGraph, shortWorkflow } from '../dependency-graph.mjs';
const PEER_RULE = 'every other running, unarchived workflow of this ledger that shares a source root (source_roots_json; unrecorded roots share all)';

export default workflowVerb('peers', ({ ledger, args, repo, emit }) => {
    const { db, workflowId, workflow: self } = verbWorkflow(ledger, args);
    const pendingRows = peerMessageRows(db).filter((row) => row.status === 'pending').map(peerMessageOf);
    const peers = peerWorkflowsOf(db, self).map((wf) => {
      const jobs = peerOpenJobsOf(db, wf.workflow_id);
      const brief = ({ key, from, to, kind, subject, at }) => ({ key, from, to, kind, subject, at });
      return {
        workflowId: wf.workflow_id, title: wf.title ?? null, phase: wf.phase ?? null, currentLeg: currentLegOf(jobs),
        ownedPaths: jobs.filter((job) => job.paths.length).map(({ jobId, op, status, paths }) => ({ jobId, op, status, paths })),
        pending: {
          toPeer: pendingRows.filter((m) => m.to === wf.workflow_id && m.from === workflowId).map(brief),
          fromPeer: pendingRows.filter((m) => m.to === workflowId && m.from === wf.workflow_id).map(brief),
        },
      };
    });
    // The ledger's cross-workflow dependency graph (waits, foundations, foreign files, record owners, work-graph
    // reads), its findings and the Supervisor's bridges; `dependencies.self` is the part touching this workflow.
    let dependencies = null;
    try {
      const graph = dependencyGraph(db, { repo });
      dependencies = { edges: graph.edges.map(({ from, to, via, ref, strength, job }) => ({ from, to, via, ref, strength, ...(job ? { job } : {}) })),
        findings: graph.findings.map(({ key, kind, workflows, summary, proposal }) => ({ key, kind, workflows, summary, action: proposal?.action ?? null, clearCut: Boolean(proposal?.clearCut) })),
        bridges: graph.bridges, self: dependenciesOf(graph, workflowId) };
    } catch (error) { dependencies = { error: String(error?.message ?? error).slice(0, 200) }; }
    const out = { ok: true, workflowId, rule: PEER_RULE, peers, dependencies };
    const dependencyLines = () => {
      if (!dependencies?.edges) return dependencies?.error ? [`dependencies: unavailable (${dependencies.error})`] : [];
      return [
        `dependencies: ${dependencies.edges.filter((e) => e.strength === 'hard').length} wait(s), ${dependencies.findings.length} finding(s), ${dependencies.bridges.length} bridge(s)`,
        ...dependencies.edges.filter((e) => e.strength === 'hard').map((e) => {
          const job = e.job ? ` (${e.job})` : '';
          return `  ${shortWorkflow(e.from)} waits on ${shortWorkflow(e.to)} via ${e.via} ${e.ref ?? '-'}${job}`;
        }),
        ...dependencies.findings.map((f) => `  ${f.kind}: ${f.summary.slice(0, 220)} -> supervisor ${f.action ?? '-'}${f.clearCut ? ' (clear-cut)' : ''}`),
        ...dependencies.bridges.map((b) => {
          const provisional = b.provisional ? ' provisional' : '';
          const owner = b.workflowId ? ` ${b.workflowId}` : '';
          const foundation = b.foundation ? ` owns ${b.foundation}` : '';
          return `  bridge ${b.id} ${b.action} ${b.state ?? '-'}${provisional}${owner}${foundation}: ${b.reason.slice(0, 160)}`;
        }),
      ];
    };
    emit(out, [
      `peers ${workflowId}: ${peers.length} running peer(s)`,
      ...peers.flatMap((peer) => {
        const leg = peer.currentLeg ? `${peer.currentLeg.op ?? '-'}:${peer.currentLeg.status} (${peer.currentLeg.jobId})` : '-';
        return [
          `  ${peer.workflowId} "${peer.title ?? '-'}" leg=${leg} pending to-peer=${peer.pending.toPeer.length} from-peer=${peer.pending.fromPeer.length}`,
          ...peer.ownedPaths.map((job) => `    ${job.jobId} ${job.op ?? '-'} ${job.status}: ${job.paths.join(', ')}`),
        ];
      }),
      ...dependencyLines(),
    ].join('\n'), args.json);
});
