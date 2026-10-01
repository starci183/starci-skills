// zip-read.mjs — read back a ZIP that zip-write.mjs wrote (stored or deflate entries, CRC-32 from node:zlib): the workflow
// purge (scripts/work/purge-workflow.mjs) and the blob GC verify an archive from disk before deleting what it holds.
import fs from 'node:fs';
import zlib from 'node:zlib';

const refuse = (message, code = 'zip-corrupt') => Object.assign(new Error(message), { code });

/** Every entry of the ZIP at `file`, re-read from disk and inflated: [{name, data, crc32, crcOk}]. Throws on a bad archive. */
export function zipRead(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw refuse(`${file} has no end-of-central-directory record`, 'zip-corrupt');
  const count = buf.readUInt16LE(eocd + 10), cdStart = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdStart;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw refuse(`${file}: bad central directory entry ${n}`, 'zip-corrupt');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), at = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    p += 46 + nlen + xlen + clen;
    if (buf.readUInt32LE(at) !== 0x04034b50) throw refuse(`${file}: bad local header for ${name}`, 'zip-corrupt');
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    const body = buf.subarray(start, start + csize);
    const data = method === 0 ? Buffer.from(body) : method === 8 ? zlib.inflateRawSync(body) : (() => { throw refuse(`${name}: compression method ${method}`, 'zip-corrupt'); })();
    const actual = zlib.crc32(data) >>> 0;
    entries.push({ name, data, crc32: actual, crcOk: actual === crc && data.length === size });
  }
  return entries;
}
