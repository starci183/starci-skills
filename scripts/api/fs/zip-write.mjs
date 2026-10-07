// zip-write.mjs — a small, dependency-free ZIP writer (deflate, CRC-32 from node:zlib; its reader is zip-visit.mjs), for the
// workflow purge's evidence archive (scripts/work/purge-workflow.mjs). Written entry by entry to a file descriptor so the
// archive never sits in memory whole; each entry's bytes are read once. The shared ZIP_RESOURCE_LIMITS envelope
// caps entry/count/total/archive sizes; no ZIP64, encrypted entries or data descriptors are supported.
import fs from 'node:fs';
import zlib from 'node:zlib';
import {sha256,sha256File} from '../../../engine/digest.mjs';
import {zipLimits} from './zip-limits.mjs';
import {validZipName} from './lib.mjs';

const U32 = 0xffffffff;
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
const refuse = (message, code = 'zip-limit') => Object.assign(new Error(message), { code });

const createWriter = (fd, limits) => ({ fd, limits, offset: 0, total: 0, names: new Set() });

function writeBuf(w, buf) {
  if (w.offset + buf.length > w.limits.maxArchiveBytes) throw refuse('archive exceeds the supported resource cap');
  let done = 0;
  while (done < buf.length) {
    const n = fs.writeSync(w.fd, buf, done, buf.length - done);
    if (!n) throw new Error('short ZIP write');
    done += n;
  }
  w.offset += buf.length;
}

function entryNameOf(w, entry) {
  const name = String(entry.name).replaceAll('\\', '/');
  if (!validZipName(name) || w.names.has(name) || Buffer.byteLength(name) > w.limits.maxNameBytes) throw refuse(`bad/duplicate entry name ${name}`, 'zip-name');
  w.names.add(name);
  return name;
}

function inlineData(entry, name, limits) {
  const n = typeof entry.data === 'string' ? Buffer.byteLength(entry.data) : entry.data.byteLength;
  if (!Number.isInteger(n) || n > limits.maxEntryBytes) throw refuse(`${name}: entry exceeds resource cap`);
  return Buffer.from(entry.data);
}

function fileData(entry, name, limits) {
  const source = fs.openSync(entry.file, 'r');
  try {
    const stat = fs.fstatSync(source);
    if (!stat.isFile() || stat.size > limits.maxEntryBytes) throw refuse(`${name}: file exceeds resource cap`);
    const data = Buffer.alloc(stat.size);
    let at = 0;
    while (at < data.length) {
      const n = fs.readSync(source, data, at, data.length - at, at);
      if (!n) throw refuse(`${name}: source truncated`);
      at += n;
    }
    const after = fs.fstatSync(source);
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw refuse(`${name}: source changed while archiving`);
    return data;
  } finally { fs.closeSync(source); }
}

function localHeaderOf({ crc, stored, body, data, nameBuf, now }) {
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(stored ? 0 : 8, 8);
  local.writeUInt16LE(dosTime(now), 10); local.writeUInt16LE(dosDate(now), 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
  return local;
}

// One entry as local header, name and body; returns its central-directory row and its report row.
function writeEntry(w, entry, now) {
  const { limits } = w;
  const name = entryNameOf(w, entry);
  const data = entry.data == null ? fileData(entry, name, limits) : inlineData(entry, name, limits);
  if (data.length > limits.maxEntryBytes || (w.total += data.length) > limits.maxTotalBytes) throw refuse(`${name}: uncompressed resource cap exceeded`);
  if (data.length >= U32) throw refuse(`${name} is ${data.length} bytes: over the 4 GiB entry limit`);
  const crc = zlib.crc32(data) >>> 0;
  const packed = zlib.deflateRawSync(data, { level: 6 });
  const stored = packed.length >= data.length;
  const body = stored ? data : packed;
  if (body.length > limits.maxCompressedEntryBytes) throw refuse(`${name}: compressed resource cap exceeded`);
  const nameBuf = Buffer.from(name, 'utf8');
  const local = localHeaderOf({ crc, stored, body, data, nameBuf, now });
  const at = w.offset;
  if (at + 30 + nameBuf.length + body.length >= U32) throw refuse('the archive would pass 4 GiB');
  writeBuf(w, local); writeBuf(w, nameBuf); writeBuf(w, body);
  return { central: { nameBuf, crc, csize: body.length, size: data.length, method: stored ? 0 : 8, at },
    record: { name, bytes: data.length, sha256: sha256(data), crc32: crc } };
}

function writeCentralDirectory(w, central, now) {
  const cdStart = w.offset;
  for (const c of central) {
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x0800, 8); h.writeUInt16LE(c.method, 10);
    h.writeUInt16LE(dosTime(now), 12); h.writeUInt16LE(dosDate(now), 14); h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.csize, 20); h.writeUInt32LE(c.size, 24);
    h.writeUInt16LE(c.nameBuf.length, 28); h.writeUInt32LE(c.at, 42);
    writeBuf(w, h); writeBuf(w, c.nameBuf);
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(central.length, 8); eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(w.offset - cdStart, 12); eocd.writeUInt32LE(cdStart, 16);
  writeBuf(w, eocd);
}

/**
 * Write `entries` ([{name, data?: Buffer|string, file?: path}]) to `file` (created; must not exist). Names are '/'
 * separated, relative, never '..'. Returns {file, bytes, sha256, entries: [{name, bytes, sha256, crc32}]}.
 */
export function zipWrite(file, entries, { now = new Date(), ...options } = {}) {
  const limits = zipLimits(options);
  if (entries.length > limits.maxEntries) throw refuse('entry count exceeds the supported resource cap');
  if (entries.length >= 0xffff) throw refuse(`${entries.length} entries: the archive format here stops at 65534`);
  const fd = fs.openSync(file, 'wx+');
  const central = [], out = [];
  const w = createWriter(fd, limits);
  let archiveSha256 = null;
  try {
    for (const entry of entries) {
      const written = writeEntry(w, entry, now);
      central.push(written.central);
      out.push(written.record);
    }
    writeCentralDirectory(w, central, now);
    fs.fsyncSync(fd);
    archiveSha256 = sha256File(fd);
  } catch (error) { fs.closeSync(fd); try { fs.rmSync(file, { force: true }); } catch { /* partial */ } throw error; }
  fs.closeSync(fd);
  return { file, bytes: w.offset, sha256: archiveSha256, entries: out };
}
