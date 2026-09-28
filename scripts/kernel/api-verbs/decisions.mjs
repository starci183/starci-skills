// api decisions — Decision Items (reconciler DESIGN §10.3, §11; lane rc-decisions). A DI is the durable message a
// decider acts on: controllers and the SLA layer open them for the Kernel, the Supervisor opens `supervisor-ruling`
// DIs instead of typing notices, the Kernel reads them first every wake and resolves each with an allowed verb.
// Rows: the ledger `inbox` table, kind 'decision', key = idempotencyKey; events decision-*. The store logic is
// scripts/reconciler/decisions.mjs (shared with the supervisor-ledger DIs and the doorbell).
//
//   decisions --workflow <wf> [--list] [--all]                 live DIs, critical first, then by dueAt
//   decisions --open --workflow <wf> --kind <k> --summary <t> [--entity-type <t> --entity-id <id>] [--decider kernel|supervisor]
//             [--due-ms <ms>] [--key <idempotencyKey>] [--evidence-file <f> | --evidence <t> | --evidence-json <json>]
//             [--allowed-verbs <csv>] [--options-json <json>] [--severity critical] [--item <owed key>] --by <actor>
//   decisions --claim <id> --by <actor>
//   decisions --resolve <id> --by <actor> --verb <what you ran> [--decision <api decide id>] [--note <t>]
//   decisions --escalate <id> [--to supervisor|owner] --by <actor> [--reason <t>]
import fs from 'node:fs';
import path from 'node:path';
import { parseJsonOr } from '../../lib/json.mjs';
import { blockingDecisions, claimDecision, decisionsFirstText, escalateDecision, listDecisions, openDecisionRow, refuse, resolutionOf, resolveDecision, sweepDecisions } from '../../reconciler/decisions.mjs';

const csv = (v) => [...new Set(String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
const evidenceOf = (args) => {
  if (args['evidence-json']) { const v = parseJsonOr(args['evidence-json'], null); if (!Array.isArray(v)) throw refuse('--evidence-json must be a JSON array', 'decision-evidence-invalid'); return v; }
  if (args['evidence-file']) {
    if (!fs.existsSync(args['evidence-file'])) throw refuse(`--evidence-file ${args['evidence-file']} does not exist`, 'decision-evidence-invalid');
    const text = fs.readFileSync(args['evidence-file'], 'utf8');
    const v = parseJsonOr(text, null);
    if (Array.isArray(v)) return v;
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 40).map((ref) => ({ ref: ref.slice(0, 400) }));
  }
  return args.evidence ? [{ ref: String(args.evidence).slice(0, 400) }] : [];
};
const line = (d) => `${d.id} [${d.status}${d.severity === 'critical' ? ' CRITICAL' : ''}] ${d.kind} ${d.entity?.type}:${d.entity?.id} due ${new Date(d.dueAt).toISOString().slice(0, 16)}Z (${d.decider}): ${d.summary}${d.allowedVerbs?.length ? `\n    resolve with: ${d.allowedVerbs.join(' | ')}` : ''}`;

export default {
  verb: 'decisions',
  required: (args) => (args.claim || args.resolve || args.escalate ? ['by'] : ['workflow']),
  kernelOnly: true,
  flags: ['open', 'list', 'all', 'next'],
  usage: '  decisions --workflow <id> [--list] [--all] [--next] | --open --workflow <id> --kind <k> --summary <t> --by <actor> [...] | --claim <id> --by <a> | --resolve <id> --by <a> --verb <v> [--decision <id>] | --escalate <id> [--to supervisor]   Decision Items: read them first every wake',
  run({ ledger, args, repo, emit }) {
    const db = ledger.db;
    const by = args.by ?? process.env.STARCI_ACTOR ?? (args.workflow ? `kernel:${args.workflow}` : null);
    if (args.open) {
      const r = openDecisionRow(ledger, {
        workflowId: args.workflow, kind: args.kind, decider: args.decider, summary: args.summary,
        entity: { type: args['entity-type'] ?? 'workflow', id: args['entity-id'] ?? args.workflow },
        dueMs: args['due-ms'], idempotencyKey: args.key, evidence: evidenceOf(args), allowedVerbs: csv(args['allowed-verbs']),
        options: args['options-json'] ? parseJsonOr(args['options-json'], []) : [], severity: args.severity, item: args.item, by,
      }, { ledgerName: path.basename(repo) });
      emit({ ok: true, created: r.created, existing: r.existing, superseded: r.superseded, decision: r.di },
        `${r.created ? 'opened' : 'already open'} ${line(r.di)}${r.superseded.length ? `\n  supersedes ${r.superseded.join(', ')}` : ''}`, args.json);
      return;
    }
    if (args.claim) {
      const d = claimDecision(ledger, String(args.claim), { by });
      emit({ ok: true, decision: d }, `${d.id} claimed by ${d.claim.by} for ${Math.round(d.claim.ttlMs / 60_000)} min`, args.json);
      return;
    }
    if (args.resolve) {
      const d = resolveDecision(ledger, String(args.resolve), { by, verb: args.verb, decisionId: args.decision ?? null, note: args.note ?? null });
      emit({ ok: true, decision: d }, `${d.id} resolved by ${d.resolution.by}: ${d.resolution.verb}`, args.json);
      return;
    }
    if (args.escalate) {
      const d = escalateDecision(ledger, String(args.escalate), { to: args.to ?? 'supervisor', by, reason: args.reason ?? null });
      emit({ ok: true, decision: d }, `${d.id} escalated to ${d.escalateTo}`, args.json);
      return;
    }
    // Close what no longer needs the Kernel first: rulings read (runtime rev acked), job DIs whose job was decided.
    const autoClosed = sweepDecisions(ledger, args.workflow);
    const blocking = blockingDecisions(db, args.workflow, { minAgeMs: 0 });
    const next = blocking.length ? resolutionOf(db, blocking[0], { repo }) : null;
    const nextText = next ? decisionsFirstText('new work', args.workflow, blocking, next) : null;
    if (args.next) {
      emit({ ok: true, workflowId: args.workflow, next, blocking: blocking.map((d) => d.id), autoClosed }, nextText ?? ('no open Decision Item blocks ' + args.workflow), args.json);
      return;
    }
    const list = listDecisions(db, { workflowId: args.workflow, all: Boolean(args.all) });
    emit({ ok: true, workflowId: args.workflow, open: list.filter((d) => d.status === 'open').length, decisions: list, next, autoClosed },
      [list.map(line).join('\n') || `no open decisions for ${args.workflow}`, nextText ? `NEXT (copy-paste):\n${nextText}` : null].filter(Boolean).join('\n\n'), args.json);
  },
};
