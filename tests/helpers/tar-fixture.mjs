// tar-fixture.mjs - builds small tar archives for the image-scan specs (headers by hand; the reader does not verify checksums).
const BLOCK = 512;

function header({ name, size = 0, type = '0', prefix = '', base256 = false }) {
  const buffer = Buffer.alloc(BLOCK);
  buffer.write(name, 0, 100, 'utf8');
  if (base256) {
    buffer[124] = 0x80;
    buffer.writeUIntBE(size, 130, 6);
  } else {
    buffer.write(size.toString(8).padStart(11, '0'), 124, 11, 'ascii');
  }
  buffer.write(type, 156, 1, 'ascii');
  buffer.write('ustar', 257, 5, 'ascii');
  if (prefix) buffer.write(prefix, 345, 155, 'utf8');
  return buffer;
}

const padded = (content) => {
  const body = Buffer.from(content);
  return Buffer.concat([body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK)]);
};

/** entries: { name, content?, type?, prefix?, base256?, longName?, pax? } -> a tar Buffer (GNU long-name and PAX path records on request). */
export function tarOf(entries, { terminate = true } = {}) {
  const parts = [];
  for (const entry of entries) {
    const content = entry.content ?? '';
    const size = Buffer.byteLength(content);
    if (entry.longName) {
      const long = `${entry.longName}\0`;
      parts.push(header({ name: '././@LongLink', size: Buffer.byteLength(long), type: 'L' }), padded(long));
    }
    if (entry.pax || entry.paxOther) {
      const record = entry.pax ? `path=${entry.pax}\n` : `${entry.paxOther}\n`;
      const line = `${String(record.length + String(record.length + 3).length + 1)} ${record}`;
      parts.push(header({ name: 'PaxHeader', size: Buffer.byteLength(line), type: 'x' }), padded(line));
    }
    parts.push(header({ name: entry.name, size, type: entry.type ?? '0', prefix: entry.prefix, base256: entry.base256 }), padded(content));
  }
  if (terminate) parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}
