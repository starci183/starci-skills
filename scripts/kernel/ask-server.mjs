// `serve-ask` — renders the one pending owner question of an `outcome: ask`
// op report as a localhost form and lands the answer durably, without any
// model agent ever seeing a secret value. Spawned detached ON DEMAND: by the
// Telegram command bridge when the owner presses an ask's "Generate URL"
// button (--on-demand telegram), or by `starci kernel serve-ask --now` / a Kernel whose
// Telegram is off (parkAsk below tells the owner instead of serving). Exits
// after one submission or on --ttl. Port: first free in engine/config.mjs ASK_PORT_BAND (the
// owner-facing ask lane).
//
//   node serve-ask.mjs --repo <path> --workflow <id> [--dispatch <id>] [--ttl <ms>] [--on-demand <via>] [--band <first..last>] [--json]
//
// Submission authorization and declared choices are checked before credential effects. Product credentials
// use scripts/hfs/secret.mjs and the app's selected sealed Stack environment. The receipt, decision and
// ask-answered event commit together; notifications follow the committed disposition.
// --review serves artifacts without admitting submissions or recording lifecycle events.
//
// Ask-report lifecycle in the ledger (modules/kernel/api.yaml askLifecycle):
// `ask-notified` when parkAsk told the owner (link on demand), `ask-serving`
// on bind (onDemand/requestedBy when the bridge asked for it),
// `ask-serving-expired` on --ttl, `ask-superseded` when a replacement for an
// earlier ask of the same op and subject (params.subject, else
// question.refs) is parked, `ask-answered` on submission, and
// `ask-message-closed` when the ask's Telegram messages were deleted.
//
// Telegram (scripts/connectors/telegram.mjs, docs/connectors.md): parkAsk —
// what `starci kernel serve-ask` runs — sends the owner an approval ask with a "Generate
// URL" button, lists a credential ask for the bridge's /creds (askClassOf) and
// serves nothing; this form never sends a message itself. On
// submit (and for an ask a replacement supersedes) closeAskMessages deletes
// the ask's messages from the chat.
//
// Auto-accept (config.yaml asks.autoAcceptRecommended, engine/config.mjs
// askAutoAcceptPolicy): an ask that carries a recommended option
// (scripts/machine/ask-recommendation.mjs) and falls in no excluded class is
// never served. autoAcceptAsk records the recommendation as the answer: the
// same starci/ask-answer@1 receipt and `ask-answered` event a submission
// writes, with answeredBy auto-recommended, plus an `ask-auto-accepted` audit
// event; it wakes the Kernel and sends the owner one plain Telegram message.
// `starci kernel serve-ask` runs the same function before it would launch the form.
// A draw-review ask (owner ruling 2026-09-26) is accepted the same way unless
// the owner asked for that drawing (drawOwnerRequestOf, from the ledger).

import '../api/process/hide-child-windows.mjs';
import { commitAskAnswer } from '../machine/ask-receipts.mjs';
import { setSecretValues } from '../hfs/secret.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { sha256 } from '../../engine/digest.mjs';
import fs from 'node:fs';
import { serve } from '../api/http/serve.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { wakeKernelForTransition } from './wake-delivery.mjs';
import { loadConfig, activeDelegation, allocationMs, askAutoAcceptPolicy, ASK_PORT_BAND } from '../../engine/config.mjs';
import { markAskClosed, notifyAsk, notifyAutoAccepted } from '../connectors/telegram.mjs';
import { parseJson } from '../lib/json.mjs';
import { MIME, imagesOf, assetsOf, toOwnerImages, reportImages, pickGroupsOf, reviewPartIndexOf, drawAnswerExtras } from './ask-images.mjs';
export { toOwnerImages, reportImages, pickGroupsOf } from './ask-images.mjs';
// notifyAsk is parkAsk's (the kernel api's) send point; this form never sends a message.
import { HANDOVER_DECISIONS, HANDOVER_OP, OWNER } from './handover.mjs';
import { AUTO_ACCEPTED_BY, AUTO_ACCEPT_CONFIG_KEY, CREDENTIAL_ASK_KINDS, askKindOf, autoAcceptDecision } from '../machine/ask-recommendation.mjs';
import { DRAW_REVIEW_DECISIONS, DRAW_REVIEW_KIND, drawOwnerRulingOf } from '../work/draw-review.mjs';
import { recordDrawAnswer } from '../work/draw-feedback.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs'; import { altOf, phrasesOf } from '../lib/source-phrases.mjs';

// The form speaks the owner's language (config.yaml `language`), English when unknown; the op writes the question
// in the same language (provision.ask, packet owner_language). Strings are English sources (scripts/lib/i18n.mjs).
const uiText = () => {
  const lang = ownerLanguage();
  const tr = translator(lang);
  return { lang, t: {
    title: tr('Owner decision'), artifacts: tr('Artifacts under review'), choose: tr('Choose'), picks: tr('Choose'),
    credentials: tr('Credentials'), note: tr('Note to the workflow (optional)'), submit: tr('Submit answer'),
    answered: tr('This ask is already answered — view only.'), received: tr('Answer received'),
    custody: tr('Secret values land in encrypted stack custody and are exposed through *_FILE pointers — never in the ledger, the chat, or any log. Submitting wakes the workflow kernel.'),
    wakes: tr('Submitting wakes the workflow kernel.'),
    partNote: tr('Note on this image (for a redraw)'),
    golden: tr('Accept and make it the golden reference for this page archetype'),
  } };
};

// A single pick group whose choices match question.options one for one is the
// same decision: render it once (the picks, with their images) and map the
// chosen pick back to its option for the receipt.
const mirroredPick = (question, pickGroups) =>
  pickGroups.length === 1 && (question.options ?? []).length > 0
  && pickGroups[0].choices.length === question.options.length ? pickGroups[0] : null;

// The owner's "one memorable lane" band, both ends included (engine/config.mjs ASK_PORT_BAND); --band narrows it.
const [ASK_FIRST, ASK_LAST] = ASK_PORT_BAND;
// The default --ttl of a served ask (modules/models/runtimes.yaml allocation.serveAsk.ttlMs).
export const DEFAULT_TTL_MS = allocationMs('serveAsk.ttlMs');

// What an ask report is about: the asking job's params.subject (report.from
// names the job) and the question's refs.
const askSubjectOf = (db, row) => {
  const rj = parseJson(row?.report_json, {}) ?? {};
  let subject = null;
  if (rj.from) {
    const job = db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(rj.from);
    const s = parseJson(job?.payload_json, {})?.params?.subject;
    if (typeof s === 'string' && s.trim()) subject = s.trim();
  }
  const refs = (Array.isArray(rj.question?.refs) ? rj.question.refs : []).map(String).filter(Boolean);
  return { subject, refs };
};
const sameAskSubject = (a, b) => {
  if (a.subject && b.subject) return a.subject === b.subject;
  if (a.refs.length && b.refs.length) return a.refs.some((ref) => b.refs.includes(ref));
  return !(a.subject || b.subject || a.refs.length || b.refs.length);
};
const esc = (s) => String(s ?? '').replaceAll(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    if (k === '--json' || k === '--review') { a[k.slice(2)] = true; continue; }
    const v = argv[++i];
    if (v === undefined) { console.error(`serve-ask: --${k.slice(2)} needs a value`); process.exit(2); }
    a[k.slice(2)] = v;
  }
  return a;
};

// A custody file becomes reachable through a `<NAME>_FILE` pointer — the same
// convention app.env already carries (keycloak-admin.json → KEYCLOAK_ADMIN_FILE).
const pointerFor = (name) => `${name.replace(/\.[^.]+$/, '').toUpperCase().replaceAll(/[^A-Z0-9]+/g, '_')}_FILE`;

// `X+\.ext` tokens without the backtracking regex: the run of token chars before each extension
// match is the token; a run an earlier match already consumed cannot start another.
const extTokensOf = (text, extRe, isChar) => {
  const out = []; let lastEnd = 0;
  for (const m of text.matchAll(extRe)) {
    let s = m.index;
    while (s > 0 && isChar.test(text[s - 1])) s -= 1;
    if (s === m.index || s < lastEnd) continue;
    out.push(text.slice(s, m.index + m[0].length));
    lastEnd = m.index + m[0].length;
  }
  return out;
};

// The ask report names its provisions in free text; the form derives the
// entry surface from the same tokens the verifier will check: custody file
// basenames (*.key/*.txt under runtime/files) and UPPER_SNAKE env variables.
// Two dedup rules keep one value from being asked twice: a var that is the
// bare base of a named custody file (github-oauth-client-secret.key ↔
// GITHUB_OAUTH_CLIENT_SECRET) is the same secret — one merged field; and a
// bare `X_FILE` var is a pointer to be derived, not a value to paste, so it
// becomes a custody field instead of a text input.
export const fieldsOf = (text) => {
  const files = [...new Set(extTokensOf(text, /\.(?:key|txt|json)/g, /[\w-]/))];
  let vars = [...new Set([...text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map(m => m[0]))]
    .filter(v => !/^(JSON|HTTP|URL|API|E2E)$/.test(v));
  const paired = {};
  for (const v of vars.filter((v) => v.endsWith('_FILE'))) {
    const base = v.slice(0, -5).toLowerCase().replaceAll('_', '-');
    if (!files.some((f) => pointerFor(f) === v)) files.push(`${base}.key`);
  }
  vars = vars.filter((v) => !v.endsWith('_FILE'));
  for (const f of files) {
    const base = pointerFor(f).slice(0, -5);
    if (vars.includes(base)) { paired[f] = base; vars = vars.filter((v) => v !== base); }
  }
  return {
    files,
    vars,
    paired,
    isSecret: (name) => /SECRET|PASSWORD|TOKEN|KEY/i.test(name),
  };
};
const optionText = (o) => (typeof o === 'string' ? o : o?.label ?? '');
const pickLabel = (o, preferId = false) => {
  if (o == null) return null;
  if (typeof o === 'string') return o;
  return preferId ? o.id ?? o.label : o.label ?? null;
};
/** The credential fields one question asks for: fieldsOf over its text and option labels. */
export const questionFields = (question) => fieldsOf(`${question?.text ?? ''}\n${(question?.options ?? []).map(optionText).join('\n')}`);

/**
 * The class of one owner ask (owner, 2026-09-25: two kinds, never mixed):
 *   approval    a decision only the owner makes; urgent, pushed to the owner at once. A
 *               handover.review or draw-review ask is always one, and so is any ask that offers
 *               options or picks, or declares a non-credential kind.
 *   credential  a request for secret values (CREDENTIAL_ASK_KINDS, or credential fields with no
 *               options); it holds only the live-proof legs (isLiveProofOp), so it is listed for the
 *               owner (Telegram /creds), never pushed.
 */
export function askClassOf({ opId = null, question = null } = {}) {
  const kind = askKindOf(question);
  if (opId === HANDOVER_OP || kind === DRAW_REVIEW_KIND) return 'approval';
  if (CREDENTIAL_ASK_KINDS.includes(kind)) return 'credential';
  if (kind || (question?.options ?? []).length || (question?.picks ?? []).length) return 'approval';
  const fields = questionFields(question);
  return fields.files.length + fields.vars.length > 0 ? 'credential' : 'approval';
}
/** The legs a credential ask holds: the live proof against the real provider (modules/ops/_common.yaml). */
export const isLiveProofOp = (op) => /^(?:integration\.verify|e2e\.verify|uat\.verify|uat\.assisted\..+)$/.test(String(op ?? ''));

const custodyDirs = repo => {
  const root = path.join(repo, '.starcistacks');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name, 'secrets')).filter(fs.existsSync);
};
const custodySlug = name => name.toLowerCase().replace(/\.[^.]+$/, '');

export const custodyPresent = (repo, name) => custodyDirs(repo).some(d => fs.existsSync(path.join(d, `${custodySlug(name)}.enc`)));

// Credential writes use the canonical sealed-secret owner; sink failures remain visible to the owner.
const writeCustody = (repo, name, value) => {
  try {
    setSecretValues(repo, { slug: custodySlug(name), values: { data: value } });
    return { ok: true, via: 'sealed-secret' };
  } catch { return { ok: false, error: 'canonical encrypted custody update failed; verify the declared environment and SOPS availability' }; }
};

// Environment values update the selected app-env envelope while preserving its other keys.
const writeEnv = (repo, key, value) => {
  try {
    setSecretValues(repo, { slug: 'app-env', values: { [key]: value } });
    return { ok: true, via: 'sealed-secret' };
  } catch { return { ok: false, error: 'canonical encrypted environment update failed; verify the declared environment and SOPS availability' }; }
};

// The owner reviews a drawing on Telegram (owner ruling 2026-09-27): a reply to the draw-review notice made of
// only ACCEPT_WORDS (the English words below plus the Vietnamese accept words of the source-phrases lexicon,
// optionally "golden") accepts; any other reply is the owner's feedback - a redraw
// whose notes are the reply's lines. A reply to one image of the album is a note on that image.
const ACCEPT_WORDS = new Set(['ok', 'okay', 'oke', 'okie', 'accept', 'accepted', 'approve', 'approved', 'lgtm', 'good', 'yes', 'uh', ...phrasesOf('drawReply.accept')]);
const GOLDEN_REPLY = new RegExp(String.raw`\bgolden\b|${altOf('drawReply.golden')}`, 'gi');
/** {decision: 'accept'|'redraw', optionIndex, golden, note} of an owner's Telegram reply to a draw-review notice. */
export function drawReplyDecision(text) {
  const raw = String(text ?? '').trim();
  const golden = GOLDEN_REPLY.test(raw);
  GOLDEN_REPLY.lastIndex = 0;
  const words = raw.replaceAll(GOLDEN_REPLY, ' ').toLowerCase().split(/[\s.,!?;:()\-–—]+/u).filter(Boolean);
  GOLDEN_REPLY.lastIndex = 0;
  const accept = (words.length > 0 || golden) && words.every((w) => ACCEPT_WORDS.has(w));
  return accept ? { decision: 'accept', optionIndex: 0, golden, note: golden ? 'golden' : null } : { decision: 'redraw', optionIndex: 1, golden: false, note: raw || null };
}

/**
 * Record the owner's Telegram reply to a draw-review notice as the ask's answer, exactly as a form submission: a
 * starci/ask-answer@1 receipt (answeredBy owner, via telegram, the verified chat and message ids), an ask-answered
 * event, the owner rulings of draw-feedback.mjs recordDrawAnswer, the Kernel woken, the notice removed. The bridge
 * calls it only for an update whose chat AND sender are connectors.telegram.chatId (telegram-bridge.mjs
 * authorized). `partPath` binds the reply to one image. Returns {ok, decision, receiptPath} or {ok:false, why}.
 */
export async function answerDrawReviewByReply({ repo, ledgerFile = null, workflowId, dispatchId, text, partPath = null, telegram = {}, now = Date.now(), wake = wakeAskAnswered, close = markAskClosed }) {
  const file = ledgerFile ?? ledgerFileFor(repo);
  const ledger = openLedger({ file });
  try {
    const db = ledger.db;
    const report = db.prepare('SELECT r.*,a.op_id FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.dispatch_id=?').get(workflowId, dispatchId);
    if (!report) return { ok: false, why: 'no ask report' };
    const question = parseJson(report.report_json, {})?.question ?? null;
    if (askKindOf(question) !== DRAW_REVIEW_KIND || !question?.review) return { ok: false, why: 'not a draw-review ask' };
    const closed = db.prepare(`SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(workflowId, dispatchId);
    if (closed) return { ok: false, why: `already ${closed.kind === 'ask-answered' ? 'answered' : 'retired'}` };
    const d = drawReplyDecision(text);
    const part = partPath ? (question.review.parts ?? []).find((p) => p?.path === partPath) : null;
    const option = (question.options ?? [])[d.optionIndex];
    const receipt = {
      schema: 'starci/ask-answer@1', workflowId, dispatchId, opId: report.op_id,
      option: pickLabel(option), optionIndex: d.optionIndex, picks: null,
      answeredBy: OWNER, via: 'telegram', telegram: { chatId: telegram.chatId ?? null, messageId: telegram.messageId ?? null, replyTo: telegram.replyTo ?? null, verified: true },
      custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [],
      note: part && d.decision === 'redraw' ? null : d.note, at: new Date(now).toISOString(),
      ...(part && d.decision === 'redraw' ? { partNotes: [{ path: part.path, shape: part.shape ?? null, note: d.note }] } : {}),
      ...(d.golden ? { golden: true } : {}),
      review: question.review,
    };
    const committed = commitAskAnswer(ledger, { workflowId, dispatchId, receipt, at: now, payload: { via: 'telegram' } });
    if (!committed.accepted) return { ok: false, why: committed.why };
    const { receiptPath } = committed;
    const rulings = recordDrawAnswer(ledger, { workflowId, report, receipt, receiptPath, repo, now });
    const woke = wake(ledger, { workflowId, dispatchId, receiptPath });
    await closeAskMessages(ledger, { ledgerFile: file, workflowId, dispatchIds: [dispatchId], reason: 'answered', by: OWNER, close });
    return { ok: true, decision: d.decision, golden: d.golden, receiptPath, rulings: rulings.rulings.length, redrawOwed: Boolean(rulings.redrawOwed), wake: woke };
  } finally { ledger.close(); }
}

/** One custody-file label+input row. */
const custodyFileRow = (name, fields, repo, disabled) => {
  const present = custodyPresent(repo, name);
  const paired = fields.paired[name] ? ` · also sets <code>${esc(fields.paired[name])}</code>` : '';
  return `<label>custody file <code>runtime/files/${esc(name)}</code> → <code>${esc(pointerFor(name))}</code>${paired}${present ? ' <b style="color:#0a7">— already in custody (leave blank to keep)</b>' : ''}</label>
    <input type="password" name="file:${esc(name)}" autocomplete="off" ${disabled}>`;
};

/** The radio fieldsets of the pick groups. */
const pickRowsOf = (pickGroups, nonce, disabled) => pickGroups.map((p) => {
  const cells = p.choices.map((c) => {
    const imgTag = c.image ? `<img src="/${esc(nonce)}/img/${esc(c.image.idx)}" alt="${esc(c.image.label)}">` : '';
    return `<label class="cell"><input type="radio" name="pick:${esc(p.id)}" value="${esc(c.id)}" required ${disabled}>
      ${imgTag}<span class="cell-label">${esc(c.label)}</span></label>`;
  }).join('\n');
  return `<fieldset class="pick"><legend>${esc(p.label ?? p.id)}</legend><div class="cells">${cells}</div></fieldset>`;
}).join('\n');

const pickedImageIndexes = (pickGroups) => { const pickedImages = new Set(); for (const p of pickGroups) for (const c of p.choices) if (c.image) pickedImages.add(c.image.idx); return pickedImages; };
/** One artifact figure, with its part-note field on a draw-review ask. */
const imgRowOf = ({ img, i, pickedImages, drawReview, question, drawText, nonce, repo, disabled }) => {
  if (pickedImages.has(i)) return '';
  const k = drawReview ? reviewPartIndexOf(question.review, img?.abs, repo) : -1;
  const noteField = k >= 0 ? `<label style="font-weight:400">${esc(drawText.partNote)}</label><textarea name="partnote:${k}" form="answer-form" rows="2" ${disabled}></textarea>` : '';
  return `<figure><img src="/${esc(nonce)}/img/${i}" alt="${esc(img.label)}"><figcaption><code>${esc(img.label)}</code></figcaption>${noteField}</figure>`;
};

const renderForm = ({ nonce, question, fields, images, repo, workflowId, readonly }) => {
  const disabled = readonly ? 'disabled' : '';
  const fileRows = fields.files.map((name) => custodyFileRow(name, fields, repo, disabled)).join('\n');
  const varRows = fields.vars.map((v) => `<label><code>${esc(v)}</code></label>
      <input type="${fields.isSecret(v) ? 'password' : 'text'}" name="env:${esc(v)}" autocomplete="off" ${disabled}>`).join('\n');
  const { lang, t } = uiText();
  const mirror = mirroredPick(question, pickGroupsOf(question, images));
  const options = mirror ? '' : (question.options ?? []).map((o, i) => `<label class="opt"><input type="radio" name="option" value="${i}" required ${disabled}> ${esc(typeof o === 'string' ? o : o?.label ?? '')}</label>`).join('\n');
  // A selection ask declares each pick dimension in question.picks — one
  // required radio group per {id, label, choices}, never free-text picks.
  // When picks are not declared, derive groups from the draw naming
  // convention (<screen>-<choice>[-round-N] / -candidate-<choice>) so the
  // owner still clicks a radio under each candidate image.
  const pickGroups = pickGroupsOf(question, images);
  const pickedImages = pickedImageIndexes(pickGroups);
  const pickRows = pickRowsOf(pickGroups, nonce, disabled);
  // A draw-review ask takes a note per image (draw-feedback.mjs: each is an owner ruling bound to that shape) and the
  // owner's golden mark on an accept.
  const drawReview = askKindOf(question) === DRAW_REVIEW_KIND && question.review;
  const drawText = { partNote: t.partNote, golden: t.golden };
  const imgRows = (images ?? []).map((img, i) => imgRowOf({ img, i, pickedImages, drawReview, question, drawText, nonce, repo, disabled })).join('\n');
  const hasCredentials = fields.files.length > 0 || fields.vars.length > 0;
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(t.title)} — ${esc(workflowId)}</title>
<style>
 body{font:14px/1.5 system-ui;margin:2rem auto;max-width:720px;padding:0 1rem;color:#222}
 h1{font-size:1.1rem}.q{white-space:pre-wrap;background:#f6f6f6;border:1px solid #ddd;padding:1rem;border-radius:6px}
 label{display:block;margin:.9rem 0 .25rem;font-weight:600}
 input[type=text],input[type=password],textarea{width:100%;padding:.45rem;border:1px solid #bbb;border-radius:4px;box-sizing:border-box}
 figure{margin:1rem 0}figure img{max-width:100%;border:1px solid #ccc;border-radius:6px;display:block}
 figcaption{font-size:.8rem;color:#666;margin-top:.25rem}
 .opt{font-weight:400;display:block;margin:.3rem 0}
 fieldset.pick{border:1px solid #ddd;border-radius:6px;margin:.6rem 0;padding:.4rem .8rem .6rem}
 fieldset.pick legend{font-weight:600;font-size:.9rem;padding:0 .3rem}
 fieldset.pick .opt{display:inline-block;margin:.2rem 1.2rem .2rem 0}
 .cells{display:flex;flex-wrap:wrap;gap:1rem}
 .cell{flex:1 1 44%;min-width:260px;font-weight:400;border:1px solid #ccc;border-radius:8px;padding:.6rem;cursor:pointer}
 .cell img{max-width:100%;display:block;border:1px solid #eee;border-radius:6px;margin:.4rem 0}
 .cell-label{display:block;font-weight:600;text-align:center}
 button{margin-top:1.2rem;padding:.6rem 1.4rem;font-size:1rem;cursor:pointer}
 .note{color:#666;font-size:.85rem;margin-top:1.5rem}
</style></head><body>
<h1>${esc(t.title)} — <code>${esc(workflowId)}</code></h1>
<div class="q">${esc(question.text ?? '')}</div>
${imgRows ? `<h3>${esc(t.artifacts)}</h3>${imgRows}` : ''}
${readonly ? `<p><b>${esc(t.answered)}</b></p>` : ''}
<form id="answer-form" method="post" action="/${esc(nonce)}/answer">
${options ? `<h3>${esc(t.choose)}</h3>${options}` : ''}
${pickRows ? `<h3>${esc(t.picks)}</h3>${pickRows}` : ''}
${hasCredentials ? `<h3>${esc(t.credentials)}</h3>\n${fileRows}\n${varRows}` : ''}
${drawReview ? `<label class="opt"><input type="checkbox" name="golden" value="1" ${disabled}> ${esc(drawText.golden)}</label>` : ''}
<label>${esc(t.note)}</label><textarea name="note" rows="2" ${disabled}></textarea>
<button type="submit" ${disabled}>${esc(t.submit)}</button>
</form>
<p class="note">${esc(hasCredentials ? t.custody : t.wakes)}</p>
</body></html>`;
};

/** Wake the Kernel whose parked ask was answered (scripts/kernel/wake-delivery.mjs wakeKernelForTransition). */
export const wakeAskAnswered = (ledger, { workflowId, dispatchId, receiptPath, answeredBy = OWNER, deps = {} }) => wakeKernelForTransition(ledger, {
  workflowId, transition: 'ask-answered', ids: { dispatchId }, deps, lines: [
    answeredBy === AUTO_ACCEPTED_BY
      ? `config.yaml ${AUTO_ACCEPT_CONFIG_KEY} answered the parked ask for dispatch ${dispatchId} with its recommended option (answeredBy ${AUTO_ACCEPTED_BY}; a later owner answer supersedes). Receipt: ${receiptPath}.`
      : `The owner answered the parked ask for dispatch ${dispatchId}; sanitized receipt at ${receiptPath}.`,
    'Re-read canonical starci kernel status and survey now; re-verify custody presence for the named provisions, settle or retry the waiting ask op, then continue the approved frontier.',
  ],
});

// Parking a replacement ask retires the ones it replaces. An earlier
// unanswered ask of the SAME op is superseded the moment a later one is
// served: without the event it stays open forever in every projection of
// the ledger, and the owner can act on a question the workflow moved past.
// "The same op" is not enough: one workflow runs several provision.ask jobs
// at once, one per decision, and a later ask about Accounting once retired
// the open Chatbot and Shell questions. A replacement asks the same thing:
// the same params.subject, else overlapping question.refs; only when
// neither side names its subject does the op alone decide.
export const supersedeEarlierAsks = (ledger, workflowId, report) => {
  const db = ledger.db;
  const newSubject = askSubjectOf(db, report);
  const superseded = db.prepare(
    `SELECT r.dispatch_id, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id
      WHERE r.workflow_id=? AND r.outcome='ask' AND a.op_id IS ? AND r.report_id < ?
        AND NOT EXISTS (SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id
          AND e.kind IN ('ask-answered','ask-superseded')
          AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
      ORDER BY r.report_id`).all(workflowId, report.op_id ?? null, report.report_id)
    .filter((row) => sameAskSubject(askSubjectOf(db, row), newSubject));
  if (superseded.length) {
    ledger.transaction(() => {
      for (const row of superseded) {
        ledger.appendEvent({
          workflowId, entityType: 'report', entityId: row.dispatch_id,
          kind: 'ask-superseded',
          payload: { dispatchId: row.dispatch_id, by: report.dispatch_id, opId: report.op_id ?? null },
        });
      }
    });
  }
  return superseded.map((row) => row.dispatch_id);
};

// The owner's auto-accept policy, read fail-closed: a config that cannot be
// read or validated never turns auto-accept on.
const loadAskPolicy = () => { try { return askAutoAcceptPolicy(loadConfig()); } catch { return null; } };

/**
 * Why the owner asked for the drawing a draw-review ask shows, from ledger data - or null, when the owner did not
 * and the drawing is accepted without them (owner ruling 2026-09-26). The owner asked when the ask is marked
 * question.ownerRequested, the owner opens its form now (`ownerOpening`: serve-ask --on-demand, the Telegram
 * Generate URL button) or opened it before (an ask-serving event with onDemand for this dispatch), or the job that
 * filed it draws on the owner's request (draw-review.mjs drawOwnerRulingOf: its retry lineage, and earlier owner
 * reviews of the same record).
 */
export function drawOwnerRequestOf(db, { workflowId, report, question, ownerOpening = false }) {
  if (question?.ownerRequested === true) return 'the ask is marked owner-requested (question.ownerRequested)';
  if (ownerOpening) return 'the owner opened the drawing to review it (Generate URL)';
  const opened = db.prepare(
    `SELECT created_at FROM events WHERE workflow_id=? AND kind='ask-serving' AND json_extract(payload_json,'$.dispatchId')=?
       AND json_extract(payload_json,'$.onDemand')=1 ORDER BY seq LIMIT 1`,
  ).get(workflowId, report.dispatch_id);
  if (opened) return `the owner opened this drawing to review it (ask-serving on demand at ${new Date(Number(opened.created_at)).toISOString()})`;
  const from = parseJson(report.report_json, {})?.from;
  const job = (from ? db.prepare('SELECT * FROM jobs WHERE job_id=? AND workflow_id=?').get(from, workflowId) : null)
    ?? db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND json_extract(payload_json,'$.orca.dispatchId')=? ORDER BY created_at DESC LIMIT 1`).get(workflowId, report.dispatch_id)
    ?? null;
  return drawOwnerRulingOf(db, { job, record: question?.review?.record ?? null, beforeReportId: report.report_id });
}

/**
 * Answer one filed ask with its recommended option when config.yaml `asks` allows it
 * (asks.autoAcceptRecommended, not excluded; ask-recommendation.mjs autoAcceptDecision). Writes the
 * starci/ask-answer@1 receipt serve-ask writes on submit, an `ask-answered` event with answeredBy
 * auto-recommended and an `ask-auto-accepted` audit event, wakes the Kernel and sends one Telegram
 * message. Returns {accepted:false, why} and writes nothing otherwise. `wake` and `notify` are
 * injectable for specs.
 */
export async function autoAcceptAsk({ ledger, ledgerFile, repo, workflowId, report, policy = loadAskPolicy(), wake = wakeAskAnswered, notify = notifyAutoAccepted, close = markAskClosed, now = Date.now(), ownerOpening = false }) {
  const db = ledger.db;
  const rj = parseJson(report.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const ownerRequest = askKindOf(question) === DRAW_REVIEW_KIND ? drawOwnerRequestOf(db, { workflowId, report, question, ownerOpening }) : null;
  const decision = autoAcceptDecision({ question, opId: report.op_id ?? null, secretFields: questionFields(question), policy, ownerRequest });
  if (!decision.accept) return { accepted: false, why: decision.why, ...(decision.detail ? { detail: decision.detail } : {}) };
  const answered = db.prepare(
    `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
  ).get(workflowId, report.dispatch_id);
  if (answered) return { accepted: false, why: 'already-answered' };
  const { index, label, reason, source } = decision.recommendation;
  const pickGroup = Array.isArray(question.picks) && question.picks.length === 1 ? question.picks[0] : null;
  const pickChoice = pickGroup ? (pickGroup.choices ?? [])[index] : null;
  const picks = pickChoice == null ? null : { [String(pickGroup.id)]: String(pickLabel(pickChoice, true)) };
  const via = { structured: 'question.recommended', text: 'marked in the option text', 'draw-review': 'the accept option of a draw-review ask' }[source] ?? source;
  const because = reason ? ` because ${reason}` : '';
  const note = `auto-accepted by config.yaml ${AUTO_ACCEPT_CONFIG_KEY}: recommended option ${index + 1} (${via})${because}`;
  const receipt = {
    schema: 'starci/ask-answer@1',
    workflowId, dispatchId: report.dispatch_id, opId: report.op_id,
    option: label, optionIndex: index, picks,
    answeredBy: AUTO_ACCEPTED_BY, autoAccepted: { rule: decision.rule, recommendedReason: reason },
    custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [],
    note, at: new Date(now).toISOString(),
    ...(question.review ? { review: question.review } : {}),
  };
  const committed = commitAskAnswer(ledger, { workflowId, dispatchId: report.dispatch_id, receipt, at: now,
    payload: { option: label, note }, events: [{ kind: 'ask-auto-accepted', payload: { dispatchId: report.dispatch_id,
      opId: report.op_id ?? null, optionIndex: index, option: label, recommendedReason: reason, rule: decision.rule,
      config: { autoAcceptRecommended: policy.autoAcceptRecommended, excludes: [...policy.excludes], source: policy.source ?? null } } }] });
  if (!committed.accepted) return { accepted: false, why: committed.why };
  const { receiptPath } = committed;
  const woke = wake(ledger, { workflowId, dispatchId: report.dispatch_id, receiptPath, answeredBy: AUTO_ACCEPTED_BY });
  // An ask the owner was already told about (auto-accept turned on later) leaves the chat.
  await closeAskMessages(ledger, { ledgerFile, workflowId, dispatchIds: [report.dispatch_id], reason: 'answered', by: AUTO_ACCEPTED_BY, close });
  const telegram = await Promise.resolve(notify({ ledgerFile, workflowId, dispatchId: report.dispatch_id, label })).catch(() => null);
  return { accepted: true, dispatchId: report.dispatch_id, optionIndex: index, option: label, source, receiptPath, answeredBy: AUTO_ACCEPTED_BY, wake: woke, telegram };
}

/**
 * Take the Telegram messages of closed asks off the owner's chat (telegram.mjs markAskClosed: delete,
 * else edit to "answered"), and record each removal as `ask-message-closed` {dispatchId, reason,
 * deleted, edited, failed}. Never throws; `close` is injectable for specs.
 */
export async function closeAskMessages(ledger, { ledgerFile, workflowId, dispatchIds, reason = 'answered', by = null, close = markAskClosed }) {
  const out = [];
  for (const dispatchId of dispatchIds ?? []) {
    const r = await Promise.resolve(close({ ledgerFile, workflowId, dispatchId, reason, by })).catch(() => null);
    if (r && (r.deleted?.length || r.edited?.length)) {
      try {
        ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-message-closed',
          payload: { dispatchId, reason, deleted: r.deleted ?? [], edited: r.edited ?? [], failed: r.failed ?? [] } });
      } catch { /* the chat is already clean; the record is best effort */ }
    }
    out.push({ dispatchId, ...(r ?? { ok: false }) });
  }
  return out;
}

/**
 * Park one filed, unanswered ask for the owner — what `starci kernel serve-ask` runs after auto-accept
 * declined it. Earlier asks it replaces are superseded (supersedeEarlierAsks) and their messages
 * leave the chat. An approval ask (askClassOf) is then pushed to the owner on Telegram (telegram.mjs
 * notifyAsk: the question, its options and a "Generate URL" button, no link — the form is served
 * only when the owner presses it); a credential ask is only listed (notifyAsk push:false): the owner
 * finds it under the bridge's /creds. A delivered notice (sent now, one already in the chat, or a
 * listing) is recorded `ask-notified` {dispatchId, onDemand:true, via:'telegram'|'creds', askClass,
 * messageId, key, fresh, fields}: the ask then waits on the owner with no form, and the frontier
 * reads it awaiting-owner, not ask-reserve. A failed send is recorded `ask-notify-failed`; Telegram
 * off records nothing. Returns {notified, askClass, superseded, telegram}; the caller serves the
 * form now when `notified` is false.
 */
export async function parkAsk({ ledger, ledgerFile, repo, workflowId, report, notify = notifyAsk, close = markAskClosed }) {
  const superseded = supersedeEarlierAsks(ledger, workflowId, report);
  if (superseded.length) await closeAskMessages(ledger, { ledgerFile, workflowId, dispatchIds: superseded, reason: 'retired', close });
  const rj = parseJson(report.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const fields = questionFields(question);
  const askClass = askClassOf({ opId: report.op_id ?? null, question });
  const telegram = await Promise.resolve(notify({ ledgerFile, repo, workflowId, dispatchId: report.dispatch_id, push: askClass === 'approval' }))
    .catch((error) => ({ ok: false, error: String(error?.message ?? error) }));
  const notified = Boolean(telegram?.sent || telegram?.listed) || telegram?.skipped === 'already notified';
  if (notified) {
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-notified',
      payload: { dispatchId: report.dispatch_id, onDemand: true, via: telegram.listed ? 'creds' : 'telegram', askClass, messageId: telegram.messageId ?? null, key: telegram.key ?? null,
        fresh: Boolean(telegram.sent), fields: { files: fields.files, vars: fields.vars } } });
  } else if (telegram?.ok === false) {
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-notify-failed',
      payload: { dispatchId: report.dispatch_id, error: String(telegram.error ?? '').slice(0, 300) } });
  }
  return { notified, askClass, superseded, telegram };
}

// The submission gates before any credential effect: the chosen option, the answering actor, and the
// delegate rules (a delegate answers only while config.yaml delegation names it; it never approves a
// handover or accepts a drawing). {optionIdx, answeredBy, delegation}, or null after a refusal response.
const submissionGuard = ({ question, report, images }, res, params) => {
  const refuse = (text) => { res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }); res.end(text); };
  const mirror = mirroredPick(question, pickGroupsOf(question, images));
  const mirroredIdx = mirror ? mirror.choices.findIndex((c) => String(c.id) === params.get(`pick:${mirror.id}`)) : -1;
  const optionIdx = params.get('option') ?? (mirroredIdx >= 0 ? String(mirroredIdx) : null);
  // answered_by: absent means the owner. A delegate may answer only while
  // config.yaml delegation names it and has not expired.
  const answeredBy = (params.get('answered_by') || 'owner').trim();
  let delegation = null;
  if (answeredBy !== 'owner') {
    try { delegation = activeDelegation(); } catch { delegation = null; }
    if (delegation?.asks !== answeredBy) {
      refuse(`answered_by ${answeredBy} is not an active owner delegate (config.yaml delegation)`);
      return null;
    }
  }
  // A handover is approved by the owner alone (modules/ops/ops/handover.review.yaml);
  // a delegate may send feedback or a question, never the approval.
  if (report.op_id === HANDOVER_OP && answeredBy !== OWNER && HANDOVER_DECISIONS[Number(optionIdx)] === 'approve') {
    refuse(`answered_by ${answeredBy} cannot approve a handover; only the owner approves it (a delegate may send feedback or a question)`);
    return null;
  }
  // A delegate may ask for a redraw, never accept a drawing: a drawing the owner did not ask for is accepted by
  // autoAcceptAsk before any form is served, so one served here is the owner's (scripts/work/draw-review.mjs).
  if (askKindOf(question) === DRAW_REVIEW_KIND && answeredBy !== OWNER && DRAW_REVIEW_DECISIONS[Number(optionIdx)] === 'accept') {
    refuse(`answered_by ${answeredBy} cannot accept a drawing; a drawing served to the owner is the owner's to accept (a delegate may ask for a redraw)`);
    return null;
  }
  return { optionIdx, answeredBy, delegation };
};

// Declared choices only: a question with options takes a valid one, each pick group one of its
// choices, and only declared credential fields may be submitted.
const declaredOnly = ({ question, images, fields }, res, params, optionIdx) => {
  const groups = pickGroupsOf(question, images);
  if ((question.options ?? []).length && (optionIdx == null || !/^\d+$/.test(optionIdx) || !(question.options ?? [])[Number(optionIdx)])) {
    res.writeHead(400); res.end('choose a declared option'); return false;
  }
  for (const group of groups) if (!group.choices.some(choice => String(choice.id) === params.get(`pick:${group.id}`))) {
    res.writeHead(400); res.end('choose a declared pick'); return false;
  }
  for (const key of params.keys()) if ((key.startsWith('file:') && !fields.files.includes(key.slice(5)))
    || (key.startsWith('env:') && !fields.vars.includes(key.slice(4)))) {
    res.writeHead(400); res.end('credential field is not declared by this ask'); return false;
  }
  return true;
};

// Credential fields into sealed custody/env, verified writes reported back; a failed write ends the
// submission (502) with what landed so the owner can reconcile — the ask stays open.
const writeCustodyFields = (repo, fields, params, result) => {
  for (const name of fields.files) {
    const pairedVar = fields.paired[name], v = params.get(`file:${name}`);
    if (v == null || v === '') continue;
    const r = writeCustody(repo, name, v);
    if (!r.ok) { result.errors.push(`${name}: ${r.error}`); continue; }
    result.custodyWritten.push(`${name} (${r.via})`);
    if (pairedVar) { const paired = writeEnv(repo, pairedVar, v); if (paired.ok) result.envWritten.push(pairedVar); else result.errors.push(`${pairedVar}: ${paired.error}`); }
  }
};
const writeEnvFields = (repo, fields, params, result) => {
  for (const v of fields.vars) {
    const val = params.get(`env:${v}`); if (val == null || val === '') continue;
    const r = writeEnv(repo, v, val); if (r.ok) result.envWritten.push(v); else result.errors.push(`${v}: ${r.error}`);
  }
};
const writeCredentialFields = ({ repo, fields }, res, params) => {
  const result = { custodyWritten: [], envWritten: [], errors: [] };
  writeCustodyFields(repo, fields, params, result);
  writeEnvFields(repo, fields, params, result);
  if (result.errors.length) { res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); res.end(`Credential update failed. Verified writes: ${result.custodyWritten.concat(result.envWritten).join(', ') || 'none'}. ${result.errors.join('; ')}. The ask remains open.`); return null; }
  return { custodyWritten: result.custodyWritten, envWritten: result.envWritten, pointersWritten: [], bridge: null, errors: result.errors };
};

/** The starci/ask-answer@1 receipt of one submission (draw-review extras keep per-part notes and golden). */
const submissionReceipt = ({ question, report, args, images }, params, { optionIdx, answeredBy, delegation, custodyWritten, envWritten, pointersWritten, bridge, errors }) => {
  const picks = {};
  for (const p of pickGroupsOf(question, images)) {
    const v = params.get(`pick:${p.id}`);
    if (v != null && v !== '') picks[p.id] = v;
  }
  return {
    schema: 'starci/ask-answer@1',
    workflowId: args.workflow, dispatchId: report.dispatch_id, opId: report.op_id,
    option: optionIdx != null ? pickLabel((question.options ?? [])[Number(optionIdx)]) : null,
    optionIndex: optionIdx != null && (question.options ?? [])[Number(optionIdx)] != null ? Number(optionIdx) : null,
    picks: Object.keys(picks).length ? picks : null,
    answeredBy, ...(delegation ? { delegation } : {}),
    custodyWritten, envWritten, pointersWritten, bridge, errors,
    note: params.get('note') || null, at: new Date().toISOString(),
    // Per-image notes and the golden mark of a draw-review answer (draw-feedback.mjs notesOfReceipt, goldenMarkOf).
    ...(askKindOf(question) === DRAW_REVIEW_KIND && question.review ? drawAnswerExtras(question.review, params) : {}),
    // A draw-review ask names the record and the part digests the owner was shown; the receipt keeps them
    // so the answer proves which drawing it accepted (scripts/work/draw-review.mjs apply).
    ...(question.review ? { review: question.review } : {}),
  };
};

// The POST /answer submission: authorization and declared choices before credential effects, then the
// committed disposition, the receipt and the Kernel wake. A failed write must not kill the one-shot
// server before the owner can retry — the ask stays unanswered and the form stays usable.
const answerSubmission = (ctx, res, body) => {
  const { db, args, report, file, ledger, repo, server } = ctx;
  try {
    const already = db.prepare(
      `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
    ).get(args.workflow, report.dispatch_id);
    if (already) {
      res.writeHead(409, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px"><h2>Already answered</h2><p>This ask was already settled — no second submission is recorded.</p></body>');
      return;
    }
    const params = new URLSearchParams(body);
    const guard = submissionGuard(ctx, res, params);
    if (!guard) return;
    if (!declaredOnly(ctx, res, params, guard.optionIdx)) return;
    const absolute = path.resolve(file), identity = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
    const key = `${identity}|${args.workflow}|${report.dispatch_id}`;
    const held = claimManager(`ask-answer-${sha256(key)}`);
    if (!held.ok) { res.writeHead(409); res.end('another answer is in progress; wait for its committed disposition'); return; }
    try {
      const closed = db.prepare(`SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded')
        AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1`).get(args.workflow, report.dispatch_id);
      if (closed?.kind === 'ask-answered' || closed?.kind === 'ask-superseded') { res.writeHead(409); res.end('ask is already closed'); return; }
      const written = writeCredentialFields(ctx, res, params);
      if (!written) return;
      const receipt = submissionReceipt(ctx, params, { ...guard, ...written });
      const committed = commitAskAnswer(ledger, { workflowId: args.workflow, dispatchId: report.dispatch_id, receipt });
      if (!committed.accepted) { res.writeHead(409); res.end('ask is already closed; verify credential custody before retrying'); return; }
      const { receiptPath } = committed;
      // The runtime, not the Kernel, turns a draw-review answer into owner rulings and an owed redraw (draw-feedback.mjs).
      try { recordDrawAnswer(ledger, { workflowId: args.workflow, report, receipt, receiptPath, repo }); } catch (error) { console.error(`serve-ask: draw feedback not recorded: ${String(error?.message ?? error).slice(0, 300)}`); }
      const wake = wakeAskAnswered(ledger, { workflowId: args.workflow, dispatchId: report.dispatch_id, receiptPath });
      const { custodyWritten, envWritten, pointersWritten, errors } = written;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>${esc(uiText().t.received)}</h2><p>custody: ${esc(custodyWritten.join(', ') || 'none')} · env: ${esc(envWritten.join(', ') || 'none')} · pointers: ${esc(pointersWritten.join(', ') || 'none')} · wake: ${esc(wake.action)}</p>
${errors.length ? `<p style="color:#a33">errors: ${esc(errors.join('; '))}</p>` : ''}
<p>You can close this tab — the workflow kernel has been notified.</p></body>`);
      ctx.done = true;
      // Answered: the ask's Telegram messages are deleted, then the form stops serving.
      closeAskMessages(ledger, { ledgerFile: file, workflowId: args.workflow, dispatchIds: [report.dispatch_id], reason: 'answered', by: guard.answeredBy })
        .catch(() => {}).finally(() => setTimeout(() => { server.close(); process.exit(0); }, 400).unref());
    } finally { held.release(); }
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>Write failed — verify any credential writes before retrying</h2><p style="color:#a33">${esc(String(error?.message ?? error))}</p>
<p>The committed ask disposition remains authoritative. Reconcile any credential writes before resubmitting.</p></body>`);
  }
};

/** The newest pending ask report of the workflow and its answered flag; exits when there is none. */
const pendingAsk = (db, args) => {
  const report = db.prepare(
    `SELECT r.*,a.op_id FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE r.workflow_id=? AND r.outcome='ask' ${args.dispatch ? 'AND r.dispatch_id=?' : ''} ORDER BY r.report_id DESC LIMIT 1`,
  ).get(...(args.dispatch ? [args.workflow, args.dispatch] : [args.workflow]));
  if (!report) { console.error(JSON.stringify({ ok: false, error: `no pending ask report for ${args.workflow}` })); process.exit(1); }
  const answered = db.prepare(
    `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
  ).get(args.workflow, report.dispatch_id);
  return { report, answered };
};

// Retire superseded asks and let the gates that own an ask answer it before a form exists: autopilot
// (scripts/kernel/autopilot-run.mjs, owner ruling 2026-09-28) answers provisionally or defers to handover, and
// config.yaml asks.autoAcceptRecommended records its recommended option. The owner opening a form
// (--on-demand) is the owner's own act: a drawing they open is one they asked to review, so it is served.
const preServeGates = async ({ ledger, file, repo, args, report, readonly }) => {
  if (readonly) return;
  const superseded = supersedeEarlierAsks(ledger, args.workflow, report);
  if (superseded.length) await closeAskMessages(ledger, { ledgerFile: file, workflowId: args.workflow, dispatchIds: superseded, reason: 'retired' });
  if (!args['on-demand']) {
    const { autopilotAnswerAsk } = await import('./autopilot-run.mjs');
    const pilot = autopilotAnswerAsk({ ledger, repo, workflowId: args.workflow, report, wake: wakeAskAnswered });
    if (pilot.handled) {
      console.log(JSON.stringify({ ok: true, workflowId: args.workflow, dispatchId: report.dispatch_id, autopilot: true, action: pilot.action, class: pilot.class, receiptPath: pilot.receiptPath ?? null }));
      process.exit(0);
    }
  }
  const auto = await autoAcceptAsk({ ledger, ledgerFile: file, repo, workflowId: args.workflow, report, ownerOpening: Boolean(args['on-demand']) });
  if (auto.accepted) {
    console.log(JSON.stringify({ ok: true, workflowId: args.workflow, dispatchId: report.dispatch_id, autoAccepted: true, optionIndex: auto.optionIndex, option: auto.option, answeredBy: auto.answeredBy, receiptPath: auto.receiptPath, wake: auto.wake?.action ?? null }));
    process.exit(0);
  }
};

/** The owner-facing images of one ask: declared assets, text tokens, then report globs — composites swapped for parts. */
const formImages = (question, rj, repo) => {
  const qText = `${question.text ?? ''}\n${(question.options ?? []).map(optionText).join('\n')}`;
  let images = assetsOf(question.assets, repo);
  if (!images.length) images = imagesOf(qText, repo);
  if (!images.length) images = reportImages(rj.files, repo);
  return toOwnerImages(images, repo);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo || !args.workflow) { console.error('serve-ask needs --repo <path> --workflow <id>'); process.exit(2); }
  const repo = path.resolve(args.repo);
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, error: `ledger-missing: ${file}` })); process.exit(1); }
  const ledger = openLedger({ file });
  const db = ledger.db;

  const { report, answered } = pendingAsk(db, args);
  const readonly = Boolean(args.review);
  if (answered && !readonly) { console.error(JSON.stringify({ ok: false, error: `ask ${report.dispatch_id} already answered` })); process.exit(1); }

  // Parking a replacement ask retires the ones it replaces (supersedeEarlierAsks), and their Telegram
  // messages leave the chat. --review reads; it never retires anything. The same gates that decide an
  // ask before a form is served run here (autopilot, then auto-accept) — each exits when it answered.
  await preServeGates({ ledger, file, repo, args, report, readonly });

  const rj = parseJson(report.report_json, {});
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const fields = questionFields(question);
  const images = formImages(question, rj, repo);
  const nonce = `a-${crypto.randomBytes(9).toString('hex')}`;
  const ttl = Number(args.ttl ?? DEFAULT_TTL_MS);

  const ctx = { db, args, report, question, images, fields, repo, file, ledger, nonce, server: null, done: false };
  const server = serve((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === `/${nonce}`) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderForm({ nonce, question, fields, images, repo, workflowId: args.workflow, readonly }));
      return;
    }
    const imgMatch = req.method === 'GET' && new RegExp(String.raw`^/${nonce}/img/(\d+)$`).exec(url.pathname);
    if (imgMatch) {
      const img = images[Number(imgMatch[1])];
      if (!img) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(img.abs).slice(1).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(img.abs).pipe(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === `/${nonce}/answer`) {
      if (readonly) { res.writeHead(405, { allow: 'GET' }); res.end('review is read-only'); return; }
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 256 * 1024) req.destroy(); });
      req.on('end', () => answerSubmission(ctx, res, body));
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  ctx.server = server;

  server.on('error', () => tryNext());
  const bandMatch = typeof args.band === 'string' ? /^(\d+)\.\.(\d+)$/.exec(args.band) : null;
  const [PORT_FIRST, PORT_LAST] = bandMatch ? [Number(bandMatch[1]), Number(bandMatch[2])] : [ASK_FIRST, ASK_LAST];
  let port = PORT_FIRST;
  const tryNext = () => {
    if (port > PORT_LAST) { console.error(JSON.stringify({ ok: false, error: `no free port in ${PORT_FIRST}..${PORT_LAST}` })); process.exit(1); }
    server.listen(port++, '127.0.0.1');
  };
  server.once('listening', () => {
    const bound = server.address().port;
    const url = `http://127.0.0.1:${bound}/${nonce}`;
    const onDemand = typeof args['on-demand'] === 'string' && args['on-demand'] ? args['on-demand'] : null;
    if (!readonly) ledger.appendEvent({
      workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id,
      kind: 'ask-serving', payload: { dispatchId: report.dispatch_id, url, pid: process.pid, fields: { files: fields.files, vars: fields.vars }, ttlMs: ttl,
        ...(onDemand ? { onDemand: true, requestedBy: onDemand } : {}) },
    });
    // Nothing is sent to Telegram here: the owner already has the ask's notice
    // (parkAsk), and the bridge that asked for this form edits it to carry the link.
    console.log(JSON.stringify({ ok: true, workflowId: args.workflow, dispatchId: report.dispatch_id, url, port: bound, ttlMs: ttl }));
  });
  tryNext();
  setTimeout(() => {
    if (ctx.done) return;
    if (!readonly) ledger.appendEvent({ workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-serving-expired', payload: { dispatchId: report.dispatch_id } });
    process.exit(0);
  }, ttl).unref();
};

if (isMain(import.meta.url)) main().catch((error) => { console.error(error); process.exit(1); });
