// starci kernel kernel-proposal — tier 2 (owner 2026-09-28): a change the Kernel needs in SHARED .claude (an op manifest,
// knowledge, grammar, a gate, runtime code) is never made by the Kernel. It files a proposed patch with its evidence;
// the Supervisor lands AUTO-tier ones through a lane (lessons.mjs tiers) and forwards IMPORTANT ones to the owner. A
// local op-override or graph-edit keeps the workflow moving meanwhile. The proposal is a ledger event plus a line in
// the Supervisor's inbox; a patch file is copied into the workflow's kernel evidence.
//
//   kernel-proposal --workflow <wf> --title <t> --evidence <t> [--patch <file.diff>] [--files <csv>] [--decision <id>]
//   kernel-proposal --workflow <wf> --list
import fs from 'node:fs';
import { stageBlob, putArtifact } from '../../machine/evidence-store.mjs';
import { PROPOSAL_KIND, csv, newId, recordKernel, refuse } from '../kernel-authority.mjs';
import { parseJsonOr } from '../../lib/json.mjs';
import { appendInbox } from '../../machine/sup-messages.mjs';

export default {
  verb: 'kernel-proposal',
  required: ['workflow'],
  kernelOnly: true,
  flags: ['list'],
  usage: '  kernel-proposal --workflow <id> --title <t> --evidence <t> [--patch <file.diff>] [--files <csv>] [--decision <id>] | --list   tier 2: a shared .claude change for the Supervisor',
  async run({ ledger, args, repo, emit }) {
    const db = ledger.db, wf = args.workflow;
    if (args.list) {
      const rows = db.prepare('SELECT entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(wf, PROPOSAL_KIND)
        .map((r) => ({ id: r.entity_id, at: r.created_at, ...parseJsonOr(r.payload_json, {}) }));
      emit({ ok: true, workflowId: wf, proposals: rows }, rows.map((p) => `${p.id} [${p.tier}] ${p.title} (${p.files?.join(', ') || 'no files'})`).join('\n') || 'no proposals', args.json);
      return;
    }
    for (const k of ['title', 'evidence']) if (!String(args[k] ?? '').trim()) throw refuse(`kernel-proposal needs --${k}`, 'proposal-incomplete');
    const dup = db.prepare('SELECT entity_id FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,\'$.title\')=? AND created_at>?').get(wf, PROPOSAL_KIND, String(args.title), Date.now() - 6 * 3_600_000);
    if (dup) throw refuse(`${dup.entity_id} already proposes "${args.title}" (last 6 h): the Supervisor owns it; keep the workflow moving`, 'proposal-duplicate', { id: dup.entity_id });
    const id = newId('kprop');
    let patchFile = null, files = csv(args.files);
    if (args.patch) {
      if (!fs.existsSync(args.patch)) throw refuse(`--patch ${args.patch} does not exist`, 'proposal-incomplete');
      const text = fs.readFileSync(args.patch, 'utf8');
      // The patch is a kernel artifact of the workflow (blob + job_artifacts proposals/<id>.diff), never a repo file.
      const blob = stageBlob(Buffer.from(text, 'utf8'), { mediaType: 'text/x-diff' });
      ledger.transaction((tx) => putArtifact(tx, { workflowId: wf, role: 'patch', kind: 'diff', name: `proposals/${id}.diff`, blob, origin: 'kernel' }));
      patchFile = blob.fileUri;
      files = [...new Set([...files, ...[...text.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((m) => m[1].trim())])];
    }
    // The tier the Supervisor will apply (supervise.yaml selfLearning.tiers): an owner-ruling, knowledge-meaning, kernel
    // contract, op-graph or config path is IMPORTANT (propose to the owner); the rest is AUTO.
    let tier = { tier: 'auto', reasons: [] };
    try { tier = (await import('../../machine/lessons.mjs')).tierOf(files.map((p) => ({ path: p, status: 'M' }))); } catch { /* the Supervisor decides */ }
    const payload = { id, title: String(args.title), evidence: String(args.evidence), files, patchFile, tier: tier.tier, tierReasons: tier.reasons, decision: args.decision ?? null, status: 'open' };
    recordKernel(ledger, { workflowId: wf, entityType: 'kernel-proposal', entityId: id, kind: PROPOSAL_KIND, repo, payload,
      msg: `kernel-proposal ${id} (${tier.tier}): ${args.title}`,
      markdown: `Kernel proposal **${id}** (${tier.tier})\n\n${args.title}\n\nEvidence: ${args.evidence}\n\nFiles: ${files.join(', ') || '-'}${patchFile ? `\n\nPatch: ${patchFile}` : ''}` });
    let inbox = null;
    try {
      inbox = appendInbox('main', { chatId: null, messageId: null, from: `kernel:${wf}`,
        text: `KERNEL-PROPOSAL ${id} (${tier.tier}) from ${wf}: ${args.title}\nEvidence: ${String(args.evidence).slice(0, 800)}${patchFile ? `\nPatch: ${patchFile}` : ''}${files.length ? `\nFiles: ${files.join(', ')}` : ''}\n(supervise.yaml kernelProposals: land AUTO through a lane, forward IMPORTANT to the owner)` })?.id ?? null;
    } catch { inbox = null; }
    emit({ ok: true, workflowId: wf, ...payload, inbox }, `kernel-proposal ${id} filed (${tier.tier}${tier.reasons.length ? `: ${tier.reasons.join('; ')}` : ''}); the Supervisor owns it now - keep the workflow moving with a local override meanwhile`, args.json);
  },
};
