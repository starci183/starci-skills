// zip-archive.mjs — a small, dependency-free ZIP writer and reader (deflate, CRC-32 from node:zlib), for the workflow
// purge's evidence archive (scripts/work/purge-workflow.mjs). Written entry by entry to a file descriptor so the
// archive never sits in memory whole; each entry's bytes are read once. Limits (no ZIP64): < 65535 entries, each
// entry and the whole archive < 4 GiB - past them writeZip refuses instead of writing a file other tools misread.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const U32 = 0xffffffff;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
const refuse = (message, code = 'zip-limit') => Object.assign(new Error(message), { code });

/**
 * Write `entries` ([{name, data?: Buffer|string, file?: path}]) to `file` (created; must not exist). Names are '/'
 * separated, relative, never '..'. Returns {file, bytes, sha256, entries: [{name, bytes, sha256, crc32}]}.
 */
export function writeZip(file, entries, { now = new Date() } = {}) {
  if (entries.length >= 0xffff) throw refuse(`${entries.length} entries: the archive format here stops at 65534`);
  const fd = fs.openSync(file, 'wx');
  const central = [], out = [];
  let offset = 0;
  const write = (buf) => { fs.writeSync(fd, buf); offset += buf.length; };
  try {
    for (const entry of entries) {
      const name = String(entry.name).replace(/\\/g, '/');
      if (!name || name.startsWith('/') || name.split('/').includes('..')) throw refuse(`bad entry name ${name}`, 'zip-name');
      const data = entry.data != null ? Buffer.from(entry.data) : fs.readFileSync(entry.file);
      if (data.length >= U32) throw refuse(`${name} is ${data.length} bytes: over the 4 GiB entry limit`);
      const crc = zlib.crc32(data) >>> 0;
      const packed = zlib.deflateRawSync(data, { level: 6 });
      const stored = packed.length >= data.length;
      const body = stored ? data : packed;
      const nameBuf = Buffer.from(name, 'utf8');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(stored ? 0 : 8, 8);
      local.writeUInt16LE(dosTime(now), 10); local.writeUInt16LE(dosDate(now), 12); local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
      const at = offset;
      if (at + 30 + nameBuf.length + body.length >= U32) throw refuse('the archive would pass 4 GiB');
      write(local); write(nameBuf); write(body);
      central.push({ nameBuf, crc, csize: body.length, size: data.length, method: stored ? 0 : 8, at });
      out.push({ name, bytes: data.length, sha256: sha256(data), crc32: crc });
    }
    const cdStart = offset;
    for (const c of central) {
      const h = Buffer.alloc(46);
      h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x0800, 8); h.writeUInt16LE(c.method, 10);
      h.writeUInt16LE(dosTime(now), 12); h.writeUInt16LE(dosDate(now), 14); h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.csize, 20); h.writeUInt32LE(c.size, 24);
      h.writeUInt16LE(c.nameBuf.length, 28); h.writeUInt32LE(c.at, 42);
      write(h); write(c.nameBuf);
    }
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(central.length, 8); eocd.writeUInt16LE(central.length, 10);
    eocd.writeUInt32LE(offset - cdStart, 12); eocd.writeUInt32LE(cdStart, 16);
    write(eocd);
    fs.fsyncSync(fd);
  } catch (error) { fs.closeSync(fd); try { fs.rmSync(file, { force: true }); } catch { /* partial */ } throw error; }
  fs.closeSync(fd);
  return { file, bytes: fs.statSync(file).size, sha256: sha256(fs.readFileSync(file)), entries: out };
}

/** Every entry of the ZIP at `file`, re-read from disk and inflated: [{name, data, crc32, crcOk}]. Throws on a bad archive. */
export function readZip(file) {
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
