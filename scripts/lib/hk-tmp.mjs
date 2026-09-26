// hk-tmp.mjs — the %TEMP% sweep of the host-housekeeping run (STORAGE-PROMPT item 1.tmp).
//
// On 2026-09-26 %TEMP% held 53k top-level entries, 45k of them older than a day — spec fixtures and runtime
// temp dirs nobody removes (starci*, evidence*, sup-k*, si*, starci-w2*, work-v3*, w1*, nivo*, orca*). The
// sweep removes the top-level entries whose names start with a prefix the allocation declares and whose
// mtime is older than the declared age. Both come from modules/models/runtimes.yaml
// `allocation.housekeeping` (tmpPrefixes, tmpMaxAgeMs) via allocationSettings(); callers may inject the
// block, so this module never reads the yaml itself past that one import.
//
// Safety, same as everywhere the runtime deletes:
//   - removal goes through safeRemoveTree only, which never descends into a junction/symlink/reparse point;
//   - a top-level entry that IS a link is skipped outright — the sweep does not even unlink it, because a
//     stray temp link pointing into a live checkout must be a human's call, not a sweeper's;
//   - `${TEMP}/claude` is never touched, whatever the prefix list says;
//   - an entry a live process holds (EBUSY/EPERM) is recorded under `skipped`, never under `errors`.
//
// The seams are injected so the spec never touches the real TEMP: `env` supplies TEMP/TMP, `now` supplies
// the clock, `remove` supplies the remover (safeRemoveTree by default), `allocation` supplies the settings.
// A dry run (apply:false) removes nothing: would-be-deleted entries land in `skipped` with the 'dry run'
// reason and their bytes in `freedBytes`, so the report reads "what --apply would free".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { allocationSettings } from '../../engine/config.mjs';
import { isLinkLike, safeRemoveTree } from './safe-remove.mjs';
import { foldCase } from './path-key.mjs';

// STORAGE-PROMPT 1.tmp declares the two-day age default. An undeclared prefix list matches nothing: the
// sweep fails safe, never wide.
const DEFAULT_TMP_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
// `${TEMP}/claude` is the live Claude Code temp area.
const PROTECTED_NAMES = new Set(['claude']);
// Removal failures that mean "a live process holds this": skipped, not errors.
const BUSY_CODES = new Set(['EBUSY', 'EPERM']);

/**
 * The bytes a file or tree occupies, walked with the same never-through-a-link discipline as
 * safeRemoveTree: a link contributes nothing because deleting it frees nothing under its target.
 */
function treeSize(root, parentReal = null) {
  let st;
  try { st = fs.lstatSync(root); } catch { return 0; }
  if (isLinkLike(root, { parentReal, stat: st })) return 0;
  if (!st.isDirectory()) return st.size;
  const real = (() => { try { return fs.realpathSync.native(root); } catch { return null; } })();
  if (!real) return st.size;
  let entries;
  try { entries = fs.readdirSync(root); } catch { return st.size; }
  let total = st.size;
  for (const name of entries) total += treeSize(path.join(root, name), real);
  return total;
}

const describe = (errors) => (errors ?? []).map((e) => `${e?.code ?? 'ERROR'}: ${e?.message ?? e ?? ''}`.trim()).join('; ');

/**
 * Sweep the top level of the temp dir. `apply` deletes; without it the run only reports.
 * Returns { ok, freedBytes, deleted: [abs paths], skipped: [{path, reason}], errors: [{path, error}] } —
 * `deleted` lists only paths actually removed, `freedBytes` counts what apply freed (or would free on a
 * dry run), `ok` is false exactly when `errors` is non-empty.
 */
export async function sweepTmp({
  apply = false,
  now = Date.now(),
  env = process.env,
  allocation = allocationSettings()?.housekeeping ?? {},
  remove = (target) => safeRemoveTree(target),
} = {}) {
  const tempRoot = path.resolve(env.TEMP ?? env.TMP ?? os.tmpdir());
  const prefixes = (Array.isArray(allocation?.tmpPrefixes) ? allocation.tmpPrefixes : [])
    .map((prefix) => foldCase(String(prefix))).filter(Boolean);
  const declaredAge = Number(allocation?.tmpMaxAgeMs);
  const maxAgeMs = Number.isFinite(declaredAge) && declaredAge > 0 ? declaredAge : DEFAULT_TMP_MAX_AGE_MS;
  const out = { ok: true, freedBytes: 0, deleted: [], skipped: [], errors: [] };

  let parentReal = null;
  try { parentReal = fs.realpathSync.native(tempRoot); } catch { /* isLinkLike resolves it per entry */ }
  let names;
  try { names = fs.readdirSync(tempRoot); } catch (error) {
    out.ok = false;
    out.errors.push({ path: tempRoot, error: String(error?.message ?? error) });
    return out;
  }

  for (const name of names) {
    const entry = path.join(tempRoot, name);
    if (PROTECTED_NAMES.has(foldCase(name))) {
      out.skipped.push({ path: entry, reason: 'protected: housekeeping never touches ${TEMP}/claude' });
      continue;
    }
    if (!prefixes.some((prefix) => foldCase(name).startsWith(prefix))) continue;
    let st;
    try { st = fs.lstatSync(entry); } catch (error) {
      if (error?.code === 'ENOENT') continue; // vanished between readdir and lstat
      out.errors.push({ path: entry, error: String(error?.message ?? error) });
      continue;
    }
    if (isLinkLike(entry, { parentReal, stat: st })) {
      out.skipped.push({ path: entry, reason: 'a link (junction/symlink/reparse point): never removed, never deleted through' });
      continue;
    }
    const ageMs = now - st.mtimeMs;
    if (!(ageMs > maxAgeMs)) {
      out.skipped.push({ path: entry, reason: `mtime age ${Math.round(ageMs)}ms is within tmpMaxAgeMs ${maxAgeMs}ms` });
      continue;
    }
    const bytes = treeSize(entry, parentReal);
    if (!apply) {
      out.skipped.push({ path: entry, reason: 'dry run: would be removed under --apply' });
      out.freedBytes += bytes;
      continue;
    }
    let result;
    try { result = remove(entry); } catch (error) {
      result = { ok: false, errors: [{ code: error?.code ?? 'ERROR', message: String(error?.message ?? error) }] };
    }
    if (result?.ok) {
      out.deleted.push(entry);
      out.freedBytes += bytes;
      continue;
    }
    const codes = (result?.errors ?? []).map((e) => e?.code).filter(Boolean);
    if (codes.some((code) => BUSY_CODES.has(code))) {
      out.skipped.push({ path: entry, reason: `held open by a live process (${codes.join(', ')})` });
    } else {
      out.errors.push({ path: entry, error: describe(result?.errors) || 'removal failed' });
    }
  }
  if (out.errors.length) out.ok = false;
  return out;
}
