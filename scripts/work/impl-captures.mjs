// impl-captures.mjs — the running-page captures a work/implementation@1 record cites (alpha.3, ARCHITECTURE-DB §5.1).
// A capture is agent output: interface.implement files it from STARCI_JOB_SCRATCH/captures with starci kernel report, and the
// record's assets[] cites each file {artifact?, name, role, sha256} - never a file under the record's assets/.
// capturesOf pairs every cited PNG with the markup cited under the same stem (<stem>.html), resolved through the blob
// store (engine/db/blob.mjs assetFileOf).
import { assetFileOf } from '../../engine/db/blob.mjs';

const nameOf = (a) => String(a?.name ?? a?.path ?? '');
const stemOf = (name) => name.replace(/\.[^./]+$/, '');

/** [{name, png, markup|null}] for every PNG the record's assets[] cites; png/markup are readable files (or null). */
export function capturesOf(recordDir, record, { db = null } = {}) {
  const assets = Array.isArray(record?.assets) ? record.assets : [];
  const markup = new Map(assets.filter((a) => /\.html?$/i.test(nameOf(a))).map((a) => [stemOf(nameOf(a)), a]));
  return assets.filter((a) => /\.png$/i.test(nameOf(a))).map((a) => {
    const m = markup.get(stemOf(nameOf(a)));
    return { name: nameOf(a), png: assetFileOf(recordDir, a, { db }), markup: m ? assetFileOf(recordDir, m, { db }) : null };
  }).sort((x, y) => x.name.localeCompare(y.name));
}
