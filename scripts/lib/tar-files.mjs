// tar-files.mjs - the regular files of a gzipped tar (an npm tarball), read in memory: {path -> Buffer}. Pure: no disk, no
// child process. Only what `npm pack` writes is understood (ustar headers, a `path` pax record and the ustar prefix
// honoured, other pax records skipped); a link or a device entry is ignored.
import zlib from 'node:zlib';

const BLOCK = 512;
const text = (buf, from, len) => buf.toString('utf8', from, from + len).replace(/\0[\s\S]*$/, '');
const octal = (buf, from, len) => parseInt(text(buf, from, len).trim() || '0', 8);

/** Map<string, Buffer> of the regular files in `tgz` (a Buffer). Throws on a truncated or corrupt archive. */
export function tarFiles(tgz) {
  const tar = zlib.gunzipSync(tgz);
  const files = new Map();
  let at = 0;
  let paxPath = null;
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    if (header.every((b) => b === 0)) break;
    const size = octal(header, 124, 12);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = text(header, 345, 155);
    const name = paxPath ?? (prefix ? `${prefix}/${text(header, 0, 100)}` : text(header, 0, 100));
    const body = tar.subarray(at + BLOCK, at + BLOCK + size);
    if (body.length < size) throw new Error(`tar entry ${name} is truncated`);
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
    if (type === 'x') {
      const record = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      paxPath = record ? record[1] : null;
      continue;
    }
    paxPath = null;
    if (type === '0') files.set(name, Buffer.from(body));
  }
  return files;
}
