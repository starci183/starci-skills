// ledger-identity.mjs — the Host controller's nightly ledger backup, gated on the registered identity
// (controllers/host.mjs ledgerHealth -> ledgerBackupStep): whether a snapshot is owed, the identity it is bound
// to, what a refused identity does and the snapshot run itself (scripts/reconciler/ledger-health.mjs --backup).
import path from 'node:path';

const LEDGER_HEALTH = 'scripts/reconciler/ledger-health.mjs';

// A file path as the registry compares it: absolute, forward slashes, case-folded where the file system folds case.
const fileKey = (file) => { const k = path.resolve(String(file)).replaceAll('\\', '/'); return process.platform === 'win32' ? k.toLowerCase() : k; };

/**
 * The identity a snapshot is bound to. The EXPECTED identity is the machine registry's: machine.sqlite ledgers row
 * named by the ctx.ledgers label (sources.mjs ledgersOf; its repo root when the label was suffixed), and that row
 * must register this very file. The file's own meta.ledger_id is only what gets verified against it, never the
 * source of the expectation, so a wrong file at a registered path is refused instead of snapshotted as that ledger.
 * {ok:true, ledgerId} or {ok:false, reason, detail} with reason registry-unavailable | unregistered |
 * registry-file-mismatch | identity-unreadable | identity-mismatch.
 */
async function ledgerIdentity(ctx, ledger) {
  const resolve = ctx.machine && typeof ctx.machine.resolveLedger === 'function' ? (q) => ctx.machine.resolveLedger(q) : null;
  if (!resolve) return { ok: false, reason: 'registry-unavailable', detail: 'ctx.machine.resolveLedger is absent: the machine registry cannot name the expected identity' };
  let rows;
  try { rows = [resolve({ name: ledger.ledgerId }), ledger.repo ? resolve({ repoRoot: ledger.repo }) : null].filter((r) => r?.ledgerId); }
  catch (error) { return { ok: false, reason: 'registry-unavailable', detail: `machine registry read failed: ${error?.message ?? error}` }; }
  if (!rows.length) return { ok: false, reason: 'unregistered', detail: `machine.sqlite ledgers has no row named ${ledger.ledgerId}${ledger.repo ? ` or for repo ${ledger.repo}` : ''}` };
  const row = rows.find((r) => r.file && fileKey(r.file) === fileKey(ledger.file));
  if (!row) return { ok: false, reason: 'registry-file-mismatch', detail: `registered ledger ${rows[0].ledgerId} is ${rows[0].file ?? 'fileless'}, not ${ledger.file}` };
  const expected = String(row.ledgerId);
  let own;
  try { own = await ctx.read(ledger.ledgerId, (db) => db.prepare("SELECT value FROM meta WHERE key='ledger_id'").get()?.value ?? null); }
  catch (error) { return { ok: false, reason: 'identity-unreadable', expected, detail: `meta.ledger_id is unreadable: ${error?.message ?? error}` }; }
  if (own == null) return { ok: false, reason: 'identity-unreadable', expected, detail: 'the file carries no meta.ledger_id' };
  if (String(own) !== expected) return { ok: false, reason: 'identity-mismatch', expected, detail: `meta.ledger_id ${own} differs from the registered ${expected}` };
  return { ok: true, ledgerId: expected };
}

/**
 * The backup lane of one product ledger, once its quick_check passed. `di` builds the Decision Items, `outputOf`
 * reads a run's JSON, `isBackupDue` is the due-hour probe (ledger-health.mjs backupDue).
 */
export function createLedgerBackup({ di, outputOf, isBackupDue }) {
  // A refused identity: no backup, a typed log row (on the edge, then at most once per quick_check period), and one
  // Supervisor DI on the edge into this reason.
  async function refuseIdentity(ctx, { rec, ledger, ledgerId, id, lh, now, out }) {
    out.backup = false; out.identity = { reason: id.reason, detail: id.detail };
    const edge = rec.identityFault !== id.reason;
    if (!edge && now - (rec.identityLoggedAt ?? 0) < lh.quickCheckEveryMs) return;
    rec.identityLoggedAt = now;
    await ctx.log('reconciler.host.ledger-identity', `${ledgerId}: ${id.reason}; the nightly backup is refused (${id.detail})`,
      { ledgerId, reason: id.reason, file: ledger.file, ...(id.expected ? { expected: id.expected } : {}) });
    if (!edge) return;
    rec.identityFault = id.reason;
    const remedy = (id.reason === 'registry-unavailable' && 'restore the engine machine.sqlite handle')
      || (id.reason === 'unregistered' && 'register the ledger in machine.sqlite (or remove the repo) with the owner')
      || 'resolve the registry and database identity with the owner';
    await ctx.openDecision(di({
      kind: 'runtime-defect', ledger: 'supervisor', productLedger: ledgerId, entity: { type: 'ledger', id: ledgerId }, idempotencyKey: `ledger-identity:${ledgerId}:${id.reason}:${now}`, severity: 'high',
      summary: `${ledgerId}: ${id.reason}; no snapshot is taken until the identity verifies; preserve the database and WAL and ${remedy}`,
      evidence: [{ ref: `ledger_identity:${id.detail}` }],
    }));
  }

  // The cheap gates of backupOwed that need no identity read: the last check passed, the retry gate is open and
  // today holds no verified snapshot yet.
  const backupCandidate = (rec, now) => rec.lastCheck?.ok === true && now >= (rec.nextBackupAttemptAt ?? 0)
    && !(rec.lastBackup?.verified === true && new Date(rec.lastBackupAt).toDateString() === new Date(now).toDateString());

  // Whether tonight's backup is owed: the last check passed, none verified today, the retry gate is open and the hour has come.
  // `ledgerId` is the ledger's real meta.ledger_id: the snapshot file is named and verified with it.
  function backupOwed(rec, { ledgerId, lh, now }) {
    const today = new Date(now).toDateString();
    const backedUpToday = rec.lastBackup?.verified === true && rec.lastBackup?.ledgerId === ledgerId && new Date(rec.lastBackupAt).toDateString() === today;
    return rec.lastCheck?.ok === true && !backedUpToday && now >= (rec.nextBackupAttemptAt ?? 0) && isBackupDue({ ledgerId, now, dir: lh.backupDir, backupHour: lh.backupHour });
  }

  async function backupLedger(ctx, { rec, ledger, ledgerId, realId, lh, now, out }) {
    const r = await ctx.run('node', [LEDGER_HEALTH, '--backup', '--ledger-id', realId, '--file', ledger.file, '--json'], { timeoutMs: lh.backupTimeoutMs });
    if (ctx.mode !== 'active' || r?.shadow) { out.backup = false; out.shadow = true; return; }
    const snapshot = outputOf(r);
    rec.lastBackupAttemptAt = now;
    rec.lastBackupAttempt = { ok: r?.ok === true, timedOut: r?.timedOut === true, result: snapshot };
    out.backup = r?.ok === true && snapshot?.ok === true && snapshot?.verified === true && snapshot?.ledgerId === realId;
    if (out.backup) {
      rec.lastBackupAt = now; rec.lastBackup = snapshot; rec.nextBackupAttemptAt = null; rec.state = 'ok';
      return;
    }
    rec.nextBackupAttemptAt = now + lh.backupRetryMs; rec.state = 'backup-failed'; out.ok = false;
    await ctx.openDecision(di({
      kind: 'runtime-defect', ledger: 'supervisor', productLedger: ledgerId, entity: { type: 'ledger', id: ledgerId }, idempotencyKey: `ledger-backup-failed:${ledgerId}`, severity: 'high',
      summary: `${ledgerId}: no verified snapshot was published; inspect backup storage access, capacity and the recorded child result before the next retry`,
      evidence: [{ ref: `engine_action:${r?.actionId ?? 'unavailable'}` }],
    }));
  }

  return async function ledgerBackupStep(ctx, { rec, ledger, ledgerId, lh, now, out }) {
    if (!backupCandidate(rec, now)) return;
    const id = await ledgerIdentity(ctx, ledger);
    if (!id.ok) { await refuseIdentity(ctx, { rec, ledger, ledgerId, id, lh, now, out }); return; }
    delete rec.identityFault; delete rec.identityLoggedAt;
    if (backupOwed(rec, { ledgerId: id.ledgerId, lh, now })) await backupLedger(ctx, { rec, ledger, ledgerId, realId: id.ledgerId, lh, now, out });
  };
}
