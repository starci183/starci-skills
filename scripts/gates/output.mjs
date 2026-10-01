import fs from 'node:fs';
import path from 'node:path';
import {redactBytes} from '../lib/redact.mjs';

/**
 * Write a check result to scratch, stdout, or the external content-addressed store. A blob is redacted first when its
 * media type is text (scripts/lib/redact.mjs); the printed {sha, redaction} is what a check_runs row cites.
 */
export async function emitCheckOutput(value, {out = null, blob = false, mediaType = 'application/json',
  write = text => process.stdout.write(text), put = null} = {}) {
  if (out && blob) throw new Error('--out and --blob are mutually exclusive');
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  if (out) {
    const file = path.resolve(out);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, bytes);
    return {out: file};
  }
  if (blob) {
    const putBlob = put ?? (await import('../../engine/db/blob.mjs')).putBlob;
    const clean = redactBytes(bytes, mediaType);
    const {sha} = await putBlob(clean.bytes, {mediaType});
    write(`${JSON.stringify({sha, redaction: clean.redaction})}\n`);
    return {sha, redaction: clean.redaction};
  }
  write(bytes.toString());
  return {};
}
