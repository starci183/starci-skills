// The mechanism proofs a report can still satisfy: judged when `starci kernel report` files the report, so the op repairs
// them inside its own attempt instead of the settler failing the attempt afterwards.
import { loadOpGate } from '../gates/read-digest.mjs';
import { classifyCheck } from './settle/check-command.mjs';
import { flag } from './mechanism-observation.mjs';
import { proofEntriesOf, producesProof, proofProducerHint, proofDocumentSchema } from './mechanism-proofs.mjs';
import { readAttached } from './attached-proof.mjs';

const MANUAL_PROOFS = new Set(['review-defects']);

/** The native binding {schema, profile, project} of a reported check the runtime can re-run as a mechanism producer; null for any other check. */
function producerOf(check, skillRoot) {
  const cls = classifyCheck(check, { skillRoot, mechanical: true });
  if (cls.kind !== 'runtime' || !cls.mechanical) return null;
  try { return { schema: cls.schema, profile: flag(cls.argv, '--scope') ?? 'code', project: flag(cls.argv, '--project') }; } catch { return null; }
}

/**
 * What a done report still owes its op's mechanism proofs: [{proof, code, detail}]. A proof is owed a re-runnable producer
 * command in report.checks (the runtime observes it natively; an attached document never stands in for the run) and the
 * document that producer printed among the attached files ([{abs, name?}]). Empty when the op owes none or the report is not done.
 */
export function proofsOwedByReport({ op, mode = null, report, files, skillRoot, doc = loadOpGate() }) {
  if (report?.outcome !== 'done') return [];
  const producers = (report.checks ?? []).map((check) => producerOf(check, skillRoot)).filter(Boolean);
  const owed = [];
  for (const { proof, projects } of proofEntriesOf(op, { mode, doc })) {
    if (MANUAL_PROOFS.has(proof)) continue;
    const unrun = (projects.length ? projects : [null]).filter((project) => !producers.some((native) => producesProof(proof, native, doc) && (!project || native.project === project)));
    const forProject = projects.length ? ` for project ${unrun.join(', ')}` : '';
    if (unrun.length) owed.push({ proof, code: 'report-proof-producer-missing',
      detail: `${proof}: no check of report.checks runs its native producer${forProject}; the runtime observes the producer itself and an attached document alone never counts. ${proofProducerHint(proof, doc, unrun.filter(Boolean))}. List that command as a report check (the runtime re-runs it, so its --out file may sit in the scratch) in the order READ, then authoring, then checks` });
    else if (!readAttached(files, proofDocumentSchema(proof, doc))) owed.push({ proof, code: 'report-proof-document-missing',
      detail: `${proof}: its producer is listed but the document it prints (schema ${proofDocumentSchema(proof, doc)}) is not among the --attach files; run the producer with --out under the job scratch and attach that file` });
  }
  return owed;
}
