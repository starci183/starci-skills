// read-bundle.mjs - the required READ of a Kernel as ONE file. A booting Kernel read each path of its plan with a tool call of its own (47 to 69 calls, 14 to 17 model turns, 1.7 to 2.3 M
// tokens measured on the newest StarCi boots), and every turn re-reads the whole context grown by the files before it. The plan now returns `bundle`: the unread files, concatenated
// with their path, size and sha256 in a header line each, in one file the Kernel reads with one call. The attestation is unchanged (the exact manifest, byte for byte): the bundle only
// carries the bytes.
import fs from 'node:fs';
import path from 'node:path';
import { kernelScratchDirOf } from './op-prompt.mjs';

/** Writes the bundle of `rows` ({path, sha256, bytes}) read from `root`; answers {file, files, bytes, missing}. */
export function writeReadBundle({ repo, workflowId, root, rows, digest }) {
  const dir = kernelScratchDirOf(repo, workflowId, 'read');
  fs.mkdirSync(dir, { recursive: true });
  const missing = [];
  const parts = rows.flatMap((row) => {
    try { return [`===== ${row.path} (${row.bytes} bytes, sha256 ${row.sha256}) =====\n${fs.readFileSync(path.join(root, row.path), 'utf8')}`]; }
    catch { missing.push(row.path); return []; }
  });
  const file = path.join(dir, `read-bundle-${String(digest).slice(0, 12)}.txt`);
  const text = `${parts.join('\n')}\n`;
  fs.writeFileSync(file, text);
  return { file, files: parts.length, bytes: Buffer.byteLength(text), ...(missing.length ? { missing } : {}) };
}
