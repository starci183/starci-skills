// affected-receipt-file.mjs - the receipt of `starci test affected --run` as a FILE: the answer carries the reference, the content lives in the file.
// A caller that must not parse a long run's output (the deploy gate) passes `--receipt-file <path>` and reads that file. Every clean, ok run also leaves its receipt
// under <runtime root>/.runtime/affected/<base>-<tip>.json, so a gate that needs the same base..tip pair accepts the run already made instead of repeating it.
import fs from 'node:fs';
import path from 'node:path';
import { runtimeStateDir } from '../../engine/runtime-root.mjs';
import { readJsonFile } from '../lib/json.mjs';

export const RECEIPT_SCHEMA = 'starci/affected-receipt@1';
const SHORT = 12;

/** Where the proven receipt of a base..tip pair lives in the tree at `root`. */
export const provenReceiptFile = (root, base, tip) => path.join(runtimeStateDir(root), 'affected', `${String(base).slice(0, SHORT)}-${String(tip).slice(0, SHORT)}.json`);

/** Writes `receipt` to `file` (tmp + rename: a reader never sees a torn file). */
function writeReceiptFile(file, receipt) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(receipt, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return file;
}

/** A receipt file's content when it is a well-formed affected receipt, else null. */
export function readReceiptFile(file) {
  const receipt = readJsonFile(file, null);
  return receipt?.schema === RECEIPT_SCHEMA ? receipt : null;
}

/** The files a finished run leaves: the caller's `--receipt-file`, and the proven receipt of a clean ok run. Returns the data fields that reference them. */
export function leaveReceipts({ root, receipt, requested }) {
  const refs = {};
  if (requested) refs.receiptFile = writeReceiptFile(path.resolve(requested), receipt);
  if (receipt.ok && receipt.clean && receipt.base && receipt.tip) refs.provenFile = writeReceiptFile(provenReceiptFile(root, receipt.base, receipt.tip), receipt);
  return refs;
}
