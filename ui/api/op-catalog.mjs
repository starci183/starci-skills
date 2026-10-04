import { fileURLToPath } from 'node:url';
import { readOpManifest } from '../../scripts/lib/op-shared.mjs';
import { opLabelMap } from '../../scripts/lib/display-names.mjs';

const OPS_DIR = new URL('../../modules/ops/ops/', import.meta.url);
const text = value => typeof value === 'string' && value.trim() ? value.replace(/\s+/g, ' ').trim() : null;
const en = value => text(value?.en) ?? text(value);
const list = value => Array.isArray(value) ? value : [];

/** Current operation reference; dispatch-captured manifests remain separate historical evidence. */
export function opInfo(op, recordedManifest = null) {
  const id = String(op ?? '').split('#')[0];
  const file = new URL(`${encodeURIComponent(id)}.yaml`, OPS_DIR);
  const label = opLabelMap()[id] ?? null;
  let doc = null, readError = null;
  try { doc = readOpManifest(fileURLToPath(file)); }
  catch (error) { readError = String(error?.message ?? error); }
  return {
    op, nameVi: text(label?.vi), nameEn: text(label?.en),
    goal: { en: en(doc?.goal), vi: text(doc?.goal?.vi) },
    reads: list(doc?.reads).map(r => ({ id: String(r?.id ?? ''), purpose: en(r?.purpose) })).filter(r => r.id),
    writes: list(doc?.writes).map(w => [w?.id, w?.path].filter(Boolean).join(' — ')).filter(Boolean),
    sideEffects: list(doc?.sideEffects).map(en).filter(Boolean),
    declarations: { reads: Array.isArray(doc?.reads), writes: Array.isArray(doc?.writes), sideEffects: Array.isArray(doc?.sideEffects) },
    manifest: fileURLToPath(file), recordedManifest, reference: 'current-runtime', readError,
  };
}
