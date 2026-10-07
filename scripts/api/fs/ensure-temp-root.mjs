// ensure-temp-root.mjs — the temp root exists and takes writes before anything is placed in it or a child is started with TEMP/TMP/TMPDIR pointing at it.
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot, TEMP_ROOT_ENV } from '../../../engine/temp-root.mjs';

const TEMP_ROOT_UNUSABLE = 'TEMP_ROOT_UNUSABLE';
const writable = new Set();

const unusable = (root, reason) => Object.assign(new Error(`${TEMP_ROOT_UNUSABLE}: the temp root ${root} ${reason}; set roots.temp in config.yaml (or ${TEMP_ROOT_ENV}) to a directory the runtime can create and write - it is not replaced by the operating-system temp directory`), { code: TEMP_ROOT_UNUSABLE, root });

/** Writes and removes one probe file in `root`: a directory that exists can still refuse writes. */
function probeWritable(root) {
  const probe = path.join(root, `.starci-write-probe-${process.pid}`);
  fs.writeFileSync(probe, '');
  fs.rmSync(probe, { force: true });
}

/** The temp root of `env`, created when it is missing. Throws an Error with code TEMP_ROOT_UNUSABLE when it cannot be created or written. */
export function ensureTempRoot({ env = process.env } = {}) {
  const root = tempRoot({ env });
  try {
    fs.mkdirSync(root, { recursive: true });
    if (!writable.has(root)) probeWritable(root);
  } catch (error) { throw unusable(root, `cannot be created or written (${error.code ?? error.message})`); }
  writable.add(root);
  return root;
}
