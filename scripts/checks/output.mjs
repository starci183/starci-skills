import fs from 'node:fs';
import path from 'node:path';

/** Write a check result to scratch, stdout, or the external content-addressed store. */
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
    const putBlob = put ?? (await import('../lib/artifact-store.mjs')).putBlob;
    const {sha} = await putBlob(bytes, {mediaType});
    write(`${JSON.stringify({sha})}\n`);
    return {sha};
  }
  write(bytes.toString());
  return {};
}
