// `serve-ask` — renders the one pending owner question of an `outcome: ask`
// op report as a localhost form and lands the answer durably, without any
// model agent ever seeing a secret value. Spawned detached ON DEMAND: by the
// Telegram command bridge when the owner presses an ask's "Generate URL"
// button (--on-demand telegram), or by `api serve-ask --now` / a Kernel whose
// Telegram is off (parkAsk below tells the owner instead of serving). Exits
// after one submission or on --ttl. Port: first free in engine/config.mjs ASK_PORT_BAND (the
// owner-facing ask lane).
//
//   node serve-ask.mjs --repo <path> --workflow <id> [--dispatch <id>] [--ttl <ms>] [--on-demand <via>] [--json]
//
// Submit flow: custody fields named '*.key|*.txt|*.json' in the question text
// are written through <repo>/scripts/stack-secret.mjs set --from-file (the
// canonical encrypted-custody write; values never touch argv or the ledger),
// and each written file auto-derives its <NAME>_FILE pointer in the canonical
// encrypted app.env — then dev-env.mjs refreshes the .env.local managed
// bridge so the pointer reaches the app's env loader. UPPER_SNAKE variables
// are upserted into BOTH .env.local (the provision-script sink) and app.env
// (the canonical encrypted env store). A sanitized receipt (names and custody
// paths only — never values) lands in kernel-evidence, an `ask-answered`
// event is appended, and the workflow's Kernel is woken through its Orca
// terminal so it can re-verify custody presence and settle the ask.
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
// what `api serve-ask` runs — sends the owner an approval ask with a "Generate
// URL" button, lists a credential ask for the bridge's /creds (askClassOf) and
// serves nothing; this form never sends a message itself. On
// submit (and for an ask a replacement supersedes) closeAskMessages deletes
// the ask's messages from the chat.
//
// Auto-accept (config.yaml asks.autoAcceptRecommended, engine/config.mjs
// askAutoAcceptPolicy): an ask that carries a recommended option
// (scripts/kernel/ask-recommendation.mjs) and falls in no excluded class is
// never served. autoAcceptAsk records the recommendation as the answer: the
// same starci/ask-answer@1 receipt and `ask-answered` event a submission
// writes, with answeredBy auto-recommended, plus an `ask-auto-accepted` audit
// event; it wakes the Kernel and sends the owner one plain Telegram message.
// `api serve-ask` runs the same function before it would launch the form.

import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { wakeKernelForTransition } from './wake-delivery.mjs';
import { loadConfig, activeDelegation, askAutoAcceptPolicy, ASK_PORT_BAND } from '../../engine/config.mjs';
import { markAskClosed, notifyAsk, notifyAutoAccepted } from '../connectors/telegram.mjs';
// notifyAsk is parkAsk's (the kernel api's) send point; this form never sends a message.
import { HANDOVER_DECISIONS, HANDOVER_OP, OWNER } from './handover.mjs';
import { AUTO_ACCEPTED_BY, AUTO_ACCEPT_CONFIG_KEY, CREDENTIAL_ASK_KINDS, askKindOf, autoAcceptDecision } from './ask-recommendation.mjs';
import { DRAW_REVIEW_DECISIONS, DRAW_REVIEW_KIND } from '../work/draw-review.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { drawImageRefs, ownerImages } from '../work/direction-part.mjs';

// The form speaks the owner's language (config.yaml `language`). Unknown
// languages fall back to English; the op writes the question itself in the
// same language (provision.ask, packet owner_language).
const UI = {
  en: { title: 'Owner decision', artifacts: 'Artifacts under review', choose: 'Choose', picks: 'Choose',
    credentials: 'Credentials', note: 'Note to the workflow (optional)', submit: 'Submit answer',
    answered: 'This ask is already answered — view only.', received: 'Answer received',
    custody: 'Secret values land in encrypted stack custody and are exposed through *_FILE pointers — never in the ledger, the chat, or any log. Submitting wakes the workflow kernel.',
    wakes: 'Submitting wakes the workflow kernel.' },
  vi: { title: 'Quyết định của thầy', artifacts: 'Hình để so sánh', choose: 'Chọn', picks: 'Chọn',
    credentials: 'Thông tin bí mật', note: 'Ghi chú cho workflow (không bắt buộc)', submit: 'Gửi câu trả lời',
    answered: 'Câu hỏi này đã được trả lời, chỉ xem.', received: 'Đã nhận câu trả lời',
    custody: 'Giá trị bí mật được lưu mã hoá trong stack custody và chỉ lộ qua con trỏ *_FILE, không bao giờ vào ledger, chat hay log. Gửi xong sẽ đánh thức kernel của workflow.',
    wakes: 'Gửi xong sẽ đánh thức kernel của workflow.' },
};
const uiText = () => { let lang = 'en'; try { lang = loadConfig()?.language ?? 'en'; } catch { /* default */ } return { lang, t: UI[lang] ?? UI.en }; };

// A single pick group whose choices match question.options one for one is the
// same decision: render it once (the picks, with their images) and map the
// chosen pick back to its option for the receipt.
const mirroredPick = (question, pickGroups) =>
  pickGroups.length === 1 && (question.options ?? []).length > 0
  && pickGroups[0].choices.length === question.options.length ? pickGroups[0] : null;

// The owner's "one memorable lane" band, both ends included (engine/config.mjs ASK_PORT_BAND).
const [PORT_FIRST, PORT_LAST] = ASK_PORT_BAND;
const DEFAULT_TTL_MS = 4 * 60 * 60 * 1000;

const parseJson = (s, fb = null) => { try { return JSON.parse(s); } catch { return fb; } };

// What an ask report is about: the asking job's params.subject (report.from
// names the job) and the question's refs.
export const askSubjectOf = (db, row) => {
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
export const sameAskSubject = (a, b) => {
  if (a.subject && b.subject) return a.subject === b.subject;
  if (a.refs.length && b.refs.length) return a.refs.some((ref) => b.refs.includes(ref));
  return !(a.subject || b.subject || a.refs.length || b.refs.length);
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
const pointerFor = (name) => `${name.replace(/\.[^.]+$/, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FILE`;

// The ask report names its provisions in free text; the form derives the
// entry surface from the same tokens the verifier will check: custody file
// basenames (*.key/*.txt under runtime/files) and UPPER_SNAKE env variables.
// Two dedup rules keep one value from being asked twice: a var that is the
// bare base of a named custody file (github-oauth-client-secret.key ↔
// GITHUB_OAUTH_CLIENT_SECRET) is the same secret — one merged field; and a
// bare `X_FILE` var is a pointer to be derived, not a value to paste, so it
// becomes a custody field instead of a text input.
export const fieldsOf = (text) => {
  const files = [...new Set([...text.matchAll(/([\w-]+\.(?:key|txt|json))/g)].map(m => m[1]))];
  let vars = [...new Set([...text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map(m => m[0]))]
    .filter(v => !/^(JSON|HTTP|URL|API|E2E)$/.test(v));
  const paired = {};
  for (const v of vars.filter((v) => v.endsWith('_FILE'))) {
    const base = v.slice(0, -5).toLowerCase().replace(/_/g, '-');
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

// An approval ask about produced artifacts is meaningless without showing
// them — extract image paths named in the question and serve them inline.
// Basenames (auth-sign-in-desktop-direction.png) are located by a bounded
// walk under .starciwork, the only tree where workflow evidence lives.
const imagesOf = (text, repo) => {
  const tokens = [...new Set([...text.matchAll(/[\w./\\-]+\.(?:png|jpe?g|webp|gif|svg)\b/gi)].map((m) => m[0]))];
  const root = path.join(repo, '.starciwork');
  const locate = (base) => {
    // BFS — a named artifact lives a few levels under .starciwork, while a
    // DFS stack would burn the whole budget inside kernel-strays archives.
    const queue = [root]; let head = 0, visited = 0;
    while (head < queue.length && visited++ < 20000) {
      const dir = queue[head++];
      let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (e.name === base) return path.join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('.')) queue.push(path.join(dir, e.name));
      }
    }
    return null;
  };
  const found = [];
  for (const t of tokens) {
    const rel = t.replace(/\\/g, '/');
    const abs = path.join(repo, rel);
    if (rel.includes('/') && fs.existsSync(abs)) { found.push({ label: rel, abs }); continue; }
    const hit = fs.existsSync(root) ? locate(path.basename(rel)) : null;
    if (hit) found.push({ label: rel, abs: hit });
  }
  return found;
};

// A candidate-pick ask often names no files in its question — the artifacts
// live behind the report's `files` globs instead. Expand each glob's static
// directory prefix and collect the newest images beneath it (bounded, so a
// stray `**` cannot crawl the whole tree).
// A selection ask declares its reviewable artifacts explicitly through
// `question.assets` — repo-relative paths, optionally {path, label} — so the
// owner judges the artifacts, not a text description of them.
const assetsOf = (assets, repo) => {
  const out = [];
  for (const a of assets ?? []) {
    const spec = typeof a === 'string' ? a : a?.path;
    if (!spec) continue;
    const rel = String(spec).replace(/\\/g, '/');
    const abs = path.join(repo, rel);
    if (fs.existsSync(abs) && MIME[path.extname(abs).slice(1).toLowerCase()])
      out.push({ label: (typeof a === 'object' && a?.label) || rel, abs });
  }
  return out;
};

// Candidate draws are always recorded in a draws.yaml next to their assets —
// when an ask names no paths at all, render the newest draw set rather than
// leaving the owner to pick blind.
// The images a draws.yaml names. Only a draws.yaml the ask's own report lists
// is read: picking "the newest draws.yaml in the tree" once served another
// workflow's candidates under an unrelated question.
// Each draw names its image as a path or {path, sha256}; the owner-facing
// one is `part`, then `content`, then `image` (drawImageRefs) — the composite
// an older draws.yaml put in `image` is swapped for its part by ownerImages.
export const drawsImages = (repo, drawsFile) => {
  const root = path.join(repo, '.starciwork');
  const newest = drawsFile;
  if (!newest || !fs.existsSync(newest)) return [];
  const text = fs.readFileSync(newest, 'utf8');
  let entries = null;
  try { const doc = parseYaml(text); if (Array.isArray(doc?.draws)) entries = doc.draws.map((d) => ({ id: d?.id ?? null, refs: drawImageRefs(d) })); } catch { /* line scan below */ }
  if (!entries) {
    entries = [];
    let id = null;
    for (const line of text.split('\n')) {
      const idM = line.match(/^\s+-\s+id:\s*(\S+)/) ?? line.match(/^\s+id:\s*(\S+)/);
      if (idM) { id = idM[1]; continue; }
      const imgM = line.match(/^\s+image:\s*(\S+)/);
      if (imgM) entries.push({ id, refs: [imgM[1]] });
    }
  }
  // draw entries resolve image paths against their ui-node dir, not
  // necessarily the evidence dir holding draws.yaml — walk ancestors up
  // to .starciwork until the relative path exists.
  const resolve = (rel) => {
    for (let up = 0, dir = path.dirname(newest); up < 6 && dir.startsWith(root); up++, dir = path.dirname(dir)) {
      const cand = path.join(dir, rel);
      if (fs.existsSync(cand)) return cand;
    }
    return null;
  };
  const out = [];
  for (const { id, refs } of entries) {
    for (const rel of refs) {
      const abs = resolve(rel);
      if (abs && MIME[path.extname(abs).slice(1).toLowerCase()]) { out.push({ label: id ?? rel, abs }); break; }
    }
  }
  return out;
};

// Owner ruling 2026-09-24: the owner reviews the drawn PART (page content,
// overlay panel, layout drawing), never the composite placed into the layout
// capture — that stays evidence for interface.implement/audit. Every image an
// ask serves goes through this: a composite becomes its part (the label
// follows it, the original path stays an alias a declared pick still
// matches), and a composite listed beside its own part collapses into one.
export const toOwnerImages = (images, repo) => {
  const repoRel = (abs) => path.relative(repo, abs).replace(/\\/g, '/');
  const labels = new Map((images ?? []).map((img) => [img?.abs, img?.label]));
  return ownerImages(images).map((img) => {
    const aliases = [...new Set(img.aliases.flatMap((a) => [labels.get(a), repoRel(a)]).filter(Boolean))];
    if (!img.composite) return { ...img, aliases };
    // A label that is the composite's own file name follows the swap; a
    // draw id or a declared label stays.
    const named = String(img.label ?? '').replace(/\\/g, '/');
    const label = !named || named.endsWith(path.basename(img.composite)) ? repoRel(img.abs) : img.label;
    return { ...img, label, aliases };
  });
};

export const reportImages = (files, repo) => {
  const out = [], seen = new Set();
  for (const spec of files ?? []) {
    const rel = String(spec).replace(/\\/g, '/');
    const abs = path.join(repo, rel);
    if (/(^|\/)draws\.yaml$/.test(rel)) {
      for (const img of drawsImages(repo, abs)) if (!seen.has(img.abs)) { seen.add(img.abs); out.push(img); }
      continue;
    }
    if (!/[*{[]/.test(rel)) {
      if (fs.existsSync(abs) && MIME[path.extname(abs).slice(1).toLowerCase()] && !seen.has(abs)) { seen.add(abs); out.push({ label: rel, abs, mtime: fs.statSync(abs).mtimeMs }); }
      continue;
    }
    const prefix = rel.slice(0, rel.search(/[*{[]/)).replace(/\/[^/]*$/, '');
    const base = path.join(repo, prefix);
    if (!fs.existsSync(base)) continue;
    const queue = [base]; let head = 0, visited = 0;
    while (head < queue.length && visited++ < 4000 && out.length < 16) {
      const dir = queue[head++];
      let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (!e.name.startsWith('.')) queue.push(p); continue; }
        if (!MIME[path.extname(e.name).slice(1).toLowerCase()] || seen.has(p)) continue;
        seen.add(p); out.push({ label: path.relative(repo, p).replace(/\\/g, '/'), abs: p, mtime: e.mtimeMs ?? fs.statSync(p).mtimeMs });
      }
    }
  }
  // An evidence bundle's direction.png is a copy of a record asset (on
  // records drawn before the part rule, of the composite): when the report
  // also names images outside evidence/, those are the ones served — the
  // same rule telegram-media applies.
  const sorted = out.sort((a, b) => b.mtime - a.mtime);
  const outside = sorted.filter((img) => !/(^|\/)evidence\//.test(path.relative(repo, img.abs).replace(/\\/g, '/')));
  return (outside.length ? outside : sorted).slice(0, 8);
};

const custodyDirs = (repo) => ['.starcistacks', '.stacks']
  .map(root => path.join(repo, root, 'dev', 'runtime', 'files'))
  .filter(d => fs.existsSync(path.dirname(d)));

const custodyPresent = (repo, name) => custodyDirs(repo).some(d => fs.existsSync(path.join(d, name)));

// Canonical encrypted-custody write; falls back to the materialized runtime
// path when the repo carries no stack-secret tool. Value travels only through
// a temp file — never argv, never the receipt.
const writeCustody = (repo, name, value) => {
  const tool = path.join(repo, 'scripts', 'stack-secret.mjs');
  const tmp = path.join(os.tmpdir(), `serve-ask-${crypto.randomBytes(8).toString('hex')}`);
  try {
    fs.writeFileSync(tmp, value, { mode: 0o600 });
    if (fs.existsSync(tool)) {
      const r = spawnSync(process.execPath, [tool, 'set', `dev/runtime/files/${name}`, '--from-file', tmp], { cwd: repo });
      if (r.status === 0) return { ok: true, via: 'stack-secret' };
      return { ok: false, error: String(r.stderr || r.stdout || 'stack-secret set failed').slice(0, 300) };
    }
    const dir = custodyDirs(repo)[0];
    if (!dir) return { ok: false, error: 'no custody dir (.starcistacks/.stacks dev/runtime/files)' };
    fs.copyFileSync(tmp, path.join(dir, name));
    return { ok: true, via: 'materialized-file' };
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
};

// Env vars go to BOTH real sinks: `.env.local` is the generated bridge the
// provision scripts read, and `.starcistacks/dev/runtime/env/app.env` is the
// canonical encrypted store (whole-file set: show → upsert → set back).
const upsertLines = (content, key, value) => {
  const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=.*$`, 'm');
  return re.test(content) ? content.replace(re, `${key}=${value}`) : `${content}${content && !content.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
};

const APP_ENV_REL = 'dev/runtime/env/app.env';

// Upsert one KEY=VALUE into the canonical encrypted app.env. Never `set` a
// whole env file we could not read first — an empty base would clobber every
// other key in the encrypted store.
const appEnvUpsert = (repo, key, value) => {
  const tool = path.join(repo, 'scripts', 'stack-secret.mjs');
  if (!fs.existsSync(tool)) return false;
  const tmp = path.join(os.tmpdir(), `serve-ask-env-${crypto.randomBytes(8).toString('hex')}`);
  try {
    spawnSync(process.execPath, [tool, 'show', APP_ENV_REL], { cwd: repo, stdio: 'ignore' });
    const cur = [path.join(repo, '.starcistacks', APP_ENV_REL), path.join(repo, '.stacks', APP_ENV_REL)].find(fs.existsSync);
    if (!cur) return false;
    fs.writeFileSync(tmp, upsertLines(fs.readFileSync(cur, 'utf8'), key, value), { mode: 0o600 });
    return spawnSync(process.execPath, [tool, 'set', APP_ENV_REL, '--from-file', tmp], { cwd: repo }).status === 0;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  }
};

const writeEnv = (repo, key, value) => {
  const via = [];
  const local = path.join(repo, '.env.local');
  fs.writeFileSync(local, upsertLines(fs.existsSync(local) ? fs.readFileSync(local, 'utf8') : '', key, value), { mode: 0o600 });
  via.push('.env.local');
  if (appEnvUpsert(repo, key, value)) via.push('app.env');
  return { ok: true, via: via.join('+') };
};

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };

// Resolve pick groups for the form: declared question.picks wins; otherwise
// groups are derived from the draw naming convention
// <screen>-<choice>[-round-N] / -candidate-<choice>. Returns [] when the
// images do not partition cleanly into >=2-choice groups — the flat artifact
// list renders instead. Each choice may carry {idx,label} of its image.
export const pickGroupsOf = (question, images) => {
  const imgs = images ?? [];
  // A question that lists its options already has its answer schema; image
  // names never add required pick groups to it.
  if (!question?.picks?.length && (question?.options ?? []).length) return [];
  if (question?.picks?.length) {
    return question.picks.map((p) => ({
      id: String(p.id), label: p.label ?? String(p.id),
      choices: (p.choices ?? []).map((c) => {
        const obj = typeof c === 'string' ? { id: c, label: c } : { id: c?.id ?? c?.label, label: c?.label ?? c?.id };
        if (obj.id == null) return null;
        if (c?.image) {
          const rel = String(c.image).replace(/\\/g, '/');
          const idx = imgs.findIndex((img) => img.label === rel || img.abs.replace(/\\/g, '/').endsWith(rel) || (img.aliases ?? []).some((a) => a === rel || String(a).endsWith(`/${rel}`)));
          if (idx >= 0) obj.image = { idx, label: imgs[idx].label };
        }
        return obj;
      }).filter(Boolean),
    }));
  }
  const groups = new Map();
  for (const [i, img] of imgs.entries()) {
    const base = path.basename(img.label ?? '', path.extname(img.label ?? ''));
    const m = base.match(/^(.+?)-(?:candidate-)?([a-z])(?:-round-\d+)?$/);
    if (!m) return [];
    const [, screen, letter] = m;
    if (!groups.has(screen)) groups.set(screen, new Map());
    groups.get(screen).set(letter, { idx: i, label: img.label });
  }
  const picks = [];
  for (const [screen, choices] of groups) {
    if (choices.size < 2) return [];
    picks.push({
      id: screen, label: screen,
      choices: [...choices.keys()].sort().map((k) => ({ id: k.toUpperCase(), label: k.toUpperCase(), image: choices.get(k) })),
    });
  }
  return picks;
};

const renderForm = ({ nonce, question, fields, images, repo, workflowId, readonly }) => {
  const fileRows = fields.files.map((name) => {
    const present = custodyPresent(repo, name);
    const paired = fields.paired[name] ? ` · also sets <code>${esc(fields.paired[name])}</code>` : '';
    return `<label>custody file <code>runtime/files/${esc(name)}</code> → <code>${esc(pointerFor(name))}</code>${paired}${present ? ' <b style="color:#0a7">— already in custody (leave blank to keep)</b>' : ''}</label>
      <input type="password" name="file:${esc(name)}" autocomplete="off" ${readonly ? 'disabled' : ''}>`;
  }).join('\n');
  const varRows = fields.vars.map((v) => `<label><code>${esc(v)}</code></label>
      <input type="${fields.isSecret(v) ? 'password' : 'text'}" name="env:${esc(v)}" autocomplete="off" ${readonly ? 'disabled' : ''}>`).join('\n');
  const { lang, t } = uiText();
  const mirror = mirroredPick(question, pickGroupsOf(question, images));
  const options = mirror ? '' : (question.options ?? []).map((o, i) => `<label class="opt"><input type="radio" name="option" value="${i}" required ${readonly ? 'disabled' : ''}> ${esc(typeof o === 'string' ? o : o?.label ?? '')}</label>`).join('\n');
  // A selection ask declares each pick dimension in question.picks — one
  // required radio group per {id, label, choices}, never free-text picks.
  // When picks are not declared, derive groups from the draw naming
  // convention (<screen>-<choice>[-round-N] / -candidate-<choice>) so the
  // owner still clicks a radio under each candidate image.
  const pickGroups = pickGroupsOf(question, images);
  const pickedImages = new Set();
  for (const p of pickGroups) for (const c of p.choices) if (c.image) pickedImages.add(c.image.idx);
  const pickRows = pickGroups.map((p) => {
    const cells = p.choices.map((c) => {
      const imgTag = c.image ? `<img src="/${esc(nonce)}/img/${esc(c.image.idx)}" alt="${esc(c.image.label)}">` : '';
      return `<label class="cell"><input type="radio" name="pick:${esc(p.id)}" value="${esc(c.id)}" required ${readonly ? 'disabled' : ''}>
        ${imgTag}<span class="cell-label">${esc(c.label)}</span></label>`;
    }).join('\n');
    return `<fieldset class="pick"><legend>${esc(p.label ?? p.id)}</legend><div class="cells">${cells}</div></fieldset>`;
  }).join('\n');
  const imgRows = (images ?? []).map((img, i) => pickedImages.has(i) ? '' : `<figure><img src="/${esc(nonce)}/img/${i}" alt="${esc(img.label)}"><figcaption><code>${esc(img.label)}</code></figcaption></figure>`).join('\n');
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
<form method="post" action="/${esc(nonce)}/answer">
${options ? `<h3>${esc(t.choose)}</h3>${options}` : ''}
${pickRows ? `<h3>${esc(t.picks)}</h3>${pickRows}` : ''}
${hasCredentials ? `<h3>${esc(t.credentials)}</h3>\n${fileRows}\n${varRows}` : ''}
<label>${esc(t.note)}</label><textarea name="note" rows="2" ${readonly ? 'disabled' : ''}></textarea>
<button type="submit" ${readonly ? 'disabled' : ''}>${esc(t.submit)}</button>
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
    'Re-read canonical api status and survey now; re-verify custody presence for the named provisions, settle or retry the waiting ask op, then continue the approved frontier.',
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
    `SELECT r.dispatch_id, r.report_json FROM reports r
      WHERE r.workflow_id=? AND r.outcome='ask' AND r.op_id IS ? AND r.report_id < ?
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
export const loadAskPolicy = () => { try { return askAutoAcceptPolicy(loadConfig()); } catch { return null; } };

/**
 * Answer one filed ask with its recommended option when config.yaml `asks` allows it
 * (asks.autoAcceptRecommended, not excluded; ask-recommendation.mjs autoAcceptDecision). Writes the
 * starci/ask-answer@1 receipt serve-ask writes on submit, an `ask-answered` event with answeredBy
 * auto-recommended and an `ask-auto-accepted` audit event, wakes the Kernel and sends one Telegram
 * message. Returns {accepted:false, why} and writes nothing otherwise. `wake` and `notify` are
 * injectable for specs.
 */
export async function autoAcceptAsk({ ledger, ledgerFile, repo, workflowId, report, policy = loadAskPolicy(), wake = wakeAskAnswered, notify = notifyAutoAccepted, close = markAskClosed, now = Date.now() }) {
  const db = ledger.db;
  const rj = parseJson(report.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const decision = autoAcceptDecision({ question, opId: report.op_id ?? null, secretFields: questionFields(question), policy });
  if (!decision.accept) return { accepted: false, why: decision.why };
  const answered = db.prepare(
    `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
  ).get(workflowId, report.dispatch_id);
  if (answered) return { accepted: false, why: 'already-answered' };
  const { index, label, reason, source } = decision.recommendation;
  const pickGroup = Array.isArray(question.picks) && question.picks.length === 1 ? question.picks[0] : null;
  const pickChoice = pickGroup ? (pickGroup.choices ?? [])[index] : null;
  const picks = pickChoice == null ? null : { [String(pickGroup.id)]: String(typeof pickChoice === 'string' ? pickChoice : pickChoice.id ?? pickChoice.label) };
  const note = `auto-accepted by config.yaml ${AUTO_ACCEPT_CONFIG_KEY}: recommended option ${index + 1} (${source === 'structured' ? 'question.recommended' : 'marked in the option text'})${reason ? ` because ${reason}` : ''}`;
  const receiptDir = path.join(repo, '.starciwork', 'kernel-evidence', workflowId, 'serve-ask');
  fs.mkdirSync(receiptDir, { recursive: true });
  const receiptPath = path.join(receiptDir, `answer-${now}.json`);
  const receipt = {
    schema: 'starci/ask-answer@1',
    workflowId, dispatchId: report.dispatch_id, opId: report.op_id,
    option: label, optionIndex: index, picks,
    answeredBy: AUTO_ACCEPTED_BY, autoAccepted: { rule: decision.rule, recommendedReason: reason },
    custodyWritten: [], envWritten: [], pointersWritten: [], bridge: null, errors: [],
    note, at: new Date(now).toISOString(),
    ...(question.review ? { review: question.review } : {}),
  };
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  ledger.transaction(() => {
    ledger.appendEvent({
      workflowId, entityType: 'report', entityId: report.dispatch_id,
      kind: 'ask-answered', payload: { dispatchId: report.dispatch_id, receiptPath, answeredBy: AUTO_ACCEPTED_BY, optionIndex: index, option: label, note, custodyWritten: [], envWritten: [], pointersWritten: [], errors: [] },
    });
    ledger.appendEvent({
      workflowId, entityType: 'report', entityId: report.dispatch_id,
      kind: 'ask-auto-accepted', payload: { dispatchId: report.dispatch_id, opId: report.op_id ?? null, optionIndex: index, option: label, recommendedReason: reason, receiptPath, rule: decision.rule, config: { autoAcceptRecommended: policy.autoAcceptRecommended, excludes: [...policy.excludes], source: policy.source ?? null } },
    });
  });
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
 * Park one filed, unanswered ask for the owner — what `api serve-ask` runs after auto-accept
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

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.repo || !args.workflow) { console.error('serve-ask needs --repo <path> --workflow <id>'); process.exit(2); }
  const repo = path.resolve(args.repo);
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) { console.error(JSON.stringify({ ok: false, error: `ledger-missing: ${file}` })); process.exit(1); }
  const ledger = openLedger({ file });
  const db = ledger.db;

  const report = db.prepare(
    `SELECT * FROM reports WHERE workflow_id=? AND outcome='ask' ${args.dispatch ? 'AND dispatch_id=?' : ''} ORDER BY report_id DESC LIMIT 1`,
  ).get(...(args.dispatch ? [args.workflow, args.dispatch] : [args.workflow]));
  if (!report) { console.error(JSON.stringify({ ok: false, error: `no pending ask report for ${args.workflow}` })); process.exit(1); }
  const answered = db.prepare(
    `SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1`,
  ).get(args.workflow, report.dispatch_id);
  const readonly = Boolean(args.review);
  if (answered && !readonly) { console.error(JSON.stringify({ ok: false, error: `ask ${report.dispatch_id} already answered` })); process.exit(1); }

  // Parking a replacement ask retires the ones it replaces
  // (supersedeEarlierAsks), and their Telegram messages leave the chat.
  // --review reads; it never retires anything.
  if (!readonly) {
    const superseded = supersedeEarlierAsks(ledger, args.workflow, report);
    if (superseded.length) await closeAskMessages(ledger, { ledgerFile: file, workflowId: args.workflow, dispatchIds: superseded, reason: 'retired' });
  }

  // An ask config.yaml asks.autoAcceptRecommended answers is never served.
  if (!readonly) {
    const auto = await autoAcceptAsk({ ledger, ledgerFile: file, repo, workflowId: args.workflow, report });
    if (auto.accepted) {
      console.log(JSON.stringify({ ok: true, workflowId: args.workflow, dispatchId: report.dispatch_id, autoAccepted: true, optionIndex: auto.optionIndex, option: auto.option, answeredBy: auto.answeredBy, receiptPath: auto.receiptPath, wake: auto.wake?.action ?? null }));
      process.exit(0);
    }
  }

  const rj = parseJson(report.report_json, {});
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const qText = `${question.text ?? ''}\n${(question.options ?? []).map(optionText).join('\n')}`;
  const fields = questionFields(question);
  let images = assetsOf(question.assets, repo);
  if (!images.length) images = imagesOf(qText, repo);
  if (!images.length) images = reportImages(rj.files, repo);
  images = toOwnerImages(images, repo);
  const nonce = `a-${crypto.randomBytes(9).toString('hex')}`;
  const ttl = Number(args.ttl ?? DEFAULT_TTL_MS);

  let done = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === `/${nonce}`) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(renderForm({ nonce, question, fields, images, repo, workflowId: args.workflow, readonly }));
      return;
    }
    const imgMatch = req.method === 'GET' && url.pathname.match(new RegExp(`^/${nonce}/img/(\\d+)$`));
    if (imgMatch) {
      const img = images[Number(imgMatch[1])];
      if (!img) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(img.abs).slice(1).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(img.abs).pipe(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === `/${nonce}/answer`) {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 256 * 1024) req.destroy(); });
      req.on('end', () => {
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
        const custodyWritten = [], envWritten = [], pointersWritten = [], errors = [];
        for (const name of fields.files) {
          const pairedVar = fields.paired[name];
          const v = params.get(`file:${name}`);
          if (v == null || v === '') {
            // Blank keeps existing custody — but a paired env var still needs
            // its raw value for provision scripts, synced from the file.
            if (pairedVar && custodyPresent(repo, name)) {
              const dir = custodyDirs(repo).find((d) => fs.existsSync(path.join(d, name)));
              const val = dir ? fs.readFileSync(path.join(dir, name), 'utf8').trim() : null;
              if (val) { writeEnv(repo, pairedVar, val); envWritten.push(`${pairedVar} (from custody)`); }
            }
            continue;
          }
          const r = writeCustody(repo, name, v);
          if (!r.ok) { errors.push(`${name}: ${r.error}`); continue; }
          custodyWritten.push(`${name} (${r.via})`);
          // The file alone is unreachable — app.env must carry its <NAME>_FILE
          // pointer for the stack env convention to see it.
          const ptr = pointerFor(name);
          if (appEnvUpsert(repo, ptr, `.starcistacks/dev/runtime/files/${name}`)) pointersWritten.push(ptr);
          // The merged env var is the same value — provision scripts read it raw.
          if (pairedVar) { writeEnv(repo, pairedVar, v); envWritten.push(pairedVar); }
        }
        for (const v of fields.vars) {
          const val = params.get(`env:${v}`);
          if (val == null || val === '') continue;
          const r = writeEnv(repo, v, val);
          envWritten.push(v);
        }
        // Regenerate the .env.local managed block so fresh *_FILE pointers in
        // app.env reach the app's env loader without a manual dev:env run.
        let bridge = null;
        const devEnv = path.join(repo, 'scripts', 'dev-env.mjs');
        if (pointersWritten.length && fs.existsSync(devEnv)) {
          const r = spawnSync(process.execPath, [devEnv], { cwd: repo, stdio: 'ignore' });
          bridge = r.status === 0 ? 'refreshed' : 'refresh-failed';
        }
        const mirror = mirroredPick(question, pickGroupsOf(question, images));
        const mirroredIdx = mirror ? mirror.choices.findIndex((c) => String(c.id) === params.get(`pick:${mirror.id}`)) : -1;
        const optionIdx = params.get('option') ?? (mirroredIdx >= 0 ? String(mirroredIdx) : null);
        // answered_by: absent means the owner. A delegate may answer only while
        // config.yaml delegation names it and has not expired.
        const answeredBy = (params.get('answered_by') || 'owner').trim();
        let delegation = null;
        if (answeredBy !== 'owner') {
          try { delegation = activeDelegation(); } catch { delegation = null; }
          if (!delegation || delegation.asks !== answeredBy) {
            res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
            res.end(`answered_by ${answeredBy} is not an active owner delegate (config.yaml delegation)`);
            return;
          }
        }
        // A handover is approved by the owner alone (modules/ops/ops/handover.review.yaml);
        // a delegate may send feedback or a question, never the approval.
        if (report.op_id === HANDOVER_OP && answeredBy !== OWNER && HANDOVER_DECISIONS[Number(optionIdx)] === 'approve') {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`answered_by ${answeredBy} cannot approve a handover; only the owner approves it (a delegate may send feedback or a question)`);
          return;
        }
        // A drawing is accepted by the owner alone (owner ruling: the owner reviews the drawn parts); a delegate may
        // ask for a redraw, never accept it (scripts/work/draw-review.mjs).
        if (askKindOf(question) === DRAW_REVIEW_KIND && answeredBy !== OWNER && DRAW_REVIEW_DECISIONS[Number(optionIdx)] === 'accept') {
          res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(`answered_by ${answeredBy} cannot accept a drawing; only the owner accepts it (a delegate may ask for a redraw)`);
          return;
        }
        const picks = {};
        for (const p of pickGroupsOf(question, images)) {
          const v = params.get(`pick:${p.id}`);
          if (v != null && v !== '') picks[p.id] = v;
        }
        const receiptDir = path.join(repo, '.starciwork', 'kernel-evidence', args.workflow, 'serve-ask');
        fs.mkdirSync(receiptDir, { recursive: true });
        const receiptPath = path.join(receiptDir, `answer-${Date.now()}.json`);
        const receipt = {
          schema: 'starci/ask-answer@1',
          workflowId: args.workflow, dispatchId: report.dispatch_id, opId: report.op_id,
          option: optionIdx != null ? (() => { const o = (question.options ?? [])[Number(optionIdx)]; return o == null ? null : (typeof o === 'string' ? o : o.label ?? null); })() : null,
          optionIndex: optionIdx != null && (question.options ?? [])[Number(optionIdx)] != null ? Number(optionIdx) : null,
          picks: Object.keys(picks).length ? picks : null,
          answeredBy, ...(delegation ? { delegation } : {}),
          custodyWritten, envWritten, pointersWritten, bridge, errors,
          note: params.get('note') || null, at: new Date().toISOString(),
          // A draw-review ask names the record and the part digests the owner was shown; the receipt keeps them
          // so the answer proves which drawing it accepted (scripts/work/draw-review.mjs apply).
          ...(question.review ? { review: question.review } : {}),
        };
        fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
        ledger.transaction(() => ledger.appendEvent({
          workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id,
          kind: 'ask-answered', payload: { dispatchId: report.dispatch_id, receiptPath, answeredBy, optionIndex: receipt.optionIndex, custodyWritten, envWritten, pointersWritten, errors },
        }));
        const wake = wakeAskAnswered(ledger, { workflowId: args.workflow, dispatchId: report.dispatch_id, receiptPath });
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>${esc(uiText().t.received)}</h2><p>custody: ${esc(custodyWritten.join(', ') || 'none')} · env: ${esc(envWritten.join(', ') || 'none')} · pointers: ${esc(pointersWritten.join(', ') || 'none')} · wake: ${esc(wake.action)}</p>
${errors.length ? `<p style="color:#a33">errors: ${esc(errors.join('; '))}</p>` : ''}
<p>You can close this tab — the workflow kernel has been notified.</p></body>`);
        done = true;
        // Answered: the ask's Telegram messages are deleted, then the form stops serving.
        closeAskMessages(ledger, { ledgerFile: file, workflowId: args.workflow, dispatchIds: [report.dispatch_id], reason: 'answered', by: answeredBy })
          .catch(() => {}).finally(() => setTimeout(() => { server.close(); process.exit(0); }, 400).unref());
        } catch (error) {
          // A failed write must not kill the one-shot server before the owner
          // can retry — the ask stays unanswered and the form stays usable.
          res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
          res.end(`<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;margin:3rem auto;max-width:560px">
<h2>Write failed — nothing was stored</h2><p style="color:#a33">${esc(String(error?.message ?? error))}</p>
<p>Go back and resubmit — the ask is still open.</p></body>`);
        }
      });
      return;
    }
    res.writeHead(404); res.end('not found');
  });

  server.on('error', () => tryNext());
  let port = PORT_FIRST;
  const tryNext = () => {
    if (port > PORT_LAST) { console.error(JSON.stringify({ ok: false, error: `no free port in ${PORT_FIRST}..${PORT_LAST}` })); process.exit(1); }
    server.listen(port++, '127.0.0.1');
  };
  server.once('listening', () => {
    const bound = server.address().port;
    const url = `http://127.0.0.1:${bound}/${nonce}`;
    const onDemand = typeof args['on-demand'] === 'string' && args['on-demand'] ? args['on-demand'] : null;
    ledger.appendEvent({
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
    if (done) return;
    ledger.appendEvent({ workflowId: args.workflow, entityType: 'report', entityId: report.dispatch_id, kind: 'ask-serving-expired', payload: { dispatchId: report.dispatch_id } });
    process.exit(0);
  }, ttl).unref();
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
