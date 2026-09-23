// png.mjs — the PNG reader and writer the layout-tree tooling composes with.
//
// No dependency: `node:zlib` inflates and deflates, and `zlib.crc32` (Node >= 22.2) stamps the chunks. It
// exists so a composite direction is a deterministic function of its inputs on every host - a consumer
// install has no sharp, and a native image library would make the same inputs produce different bytes on
// two machines. What it reads: bit depths 1/2/4/8/16, colour types 0 (greyscale), 2 (truecolour), 3
// (palette, with tRNS), 4 (greyscale + alpha) and 6 (truecolour + alpha), non-interlaced. Everything else
// throws `unsupported png: <why>` rather than guessing. Every image is handed back as 8-bit RGBA.
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode PNG bytes into {width, height, data: Uint8Array RGBA}. Throws `unsupported png: ...`. */
export function decodePng(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('unsupported png: not a PNG signature');
  let header = null, palette = null, trns = null;
  const idat = [];
  for (let at = 8; at + 8 <= buf.length;) {
    const length = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8), start = at + 8;
    if (start + length + 4 > buf.length) throw new Error(`unsupported png: chunk ${type} runs past the end of the file`);
    const body = buf.subarray(start, start + length);
    if (type === 'IHDR') header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], colour: body[9], interlace: body[12] };
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at = start + length + 4;
  }
  if (!header || !header.width || !header.height) throw new Error('unsupported png: no usable IHDR');
  const { width, height, depth, colour } = header;
  if (!(colour in CHANNELS)) throw new Error(`unsupported png: colour type ${colour}`);
  if (![1, 2, 4, 8, 16].includes(depth) || ((colour === 2 || colour === 4 || colour === 6) && depth < 8) || (colour === 3 && depth > 8)) throw new Error(`unsupported png: bit depth ${depth} for colour type ${colour}`);
  if (header.interlace !== 0) throw new Error('unsupported png: interlaced (Adam7) images are not read');
  if (colour === 3 && !palette) throw new Error('unsupported png: palette image without PLTE');
  let raw;
  try { raw = zlib.inflateSync(Buffer.concat(idat)); } catch (error) { throw new Error(`unsupported png: image data does not inflate (${error.message})`); }
  const channels = CHANNELS[colour];
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, bitsPerPixel >> 3);
  if (raw.length < (stride + 1) * height) throw new Error('unsupported png: image data shorter than the header declares');
  const out = new Uint8Array(width * height * 4);
  let prior = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const at = y * (stride + 1), filter = raw[at];
    if (filter > 4) throw new Error(`unsupported png: filter type ${filter}`);
    for (let i = 0; i < stride; i += 1) {
      const x = raw[at + 1 + i], a = i >= bpp ? line[i - bpp] : 0, b = prior[i], c = i >= bpp ? prior[i - bpp] : 0;
      line[i] = (filter === 0 ? x : filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    }
    const sample = (index) => {
      if (depth === 8) return line[index];
      if (depth === 16) return line[index * 2];
      const bit = index * depth, byte = line[bit >> 3], shift = 8 - depth - (bit & 7);
      return (byte >> shift) & ((1 << depth) - 1);
    };
    const scale = depth < 8 && colour !== 3 ? 255 / ((1 << depth) - 1) : 1;
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4, s = x * channels;
      if (colour === 3) {
        const index = sample(s);
        out[o] = palette[index * 3] ?? 0; out[o + 1] = palette[index * 3 + 1] ?? 0; out[o + 2] = palette[index * 3 + 2] ?? 0;
        out[o + 3] = trns && index < trns.length ? trns[index] : 255;
      } else if (colour === 0 || colour === 4) {
        const g = Math.round(sample(s) * scale);
        out[o] = g; out[o + 1] = g; out[o + 2] = g; out[o + 3] = colour === 4 ? sample(s + 1) : 255;
      } else {
        out[o] = sample(s); out[o + 1] = sample(s + 1); out[o + 2] = sample(s + 2); out[o + 3] = colour === 6 ? sample(s + 3) : 255;
      }
    }
    prior = Uint8Array.from(line);
  }
  return { width, height, data: out };
}

const chunk = (type, body) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'latin1'), body])) >>> 0, 0);
  return Buffer.concat([head, body, crc]);
};

/** Encode {width, height, data RGBA} as PNG: truecolour when fully opaque, else truecolour + alpha. Filter 0, fixed deflate level. */
export function encodePng({ width, height, data }) {
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
  const channels = opaque ? 3 : 4, stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4, d = row + 1 + x * channels;
      raw[d] = data[s]; raw[d + 1] = data[s + 1]; raw[d + 2] = data[s + 2];
      if (!opaque) raw[d + 3] = data[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** A blank RGBA image filled with one colour [r, g, b, a]. */
export function blankImage(width, height, rgba = [255, 255, 255, 255]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3]; }
  return { width, height, data };
}

/**
 * Resample `image` to width x height. Downscaling by more than half averages the covered source area (a box
 * filter), everything else is bilinear. Pure arithmetic, so the same inputs give the same pixels anywhere.
 */
export function resizeImage(image, width, height) {
  if (image.width === width && image.height === height) return { width, height, data: Uint8Array.from(image.data) };
  const out = new Uint8Array(width * height * 4), sx = image.width / width, sy = image.height / height, src = image.data;
  if (sx > 2 || sy > 2) {
    for (let y = 0; y < height; y += 1) {
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
        const sum = [0, 0, 0, 0];
        for (let yy = y0; yy < y1; yy += 1) for (let xx = x0; xx < x1; xx += 1) { const s = (yy * image.width + xx) * 4; sum[0] += src[s]; sum[1] += src[s + 1]; sum[2] += src[s + 2]; sum[3] += src[s + 3]; }
        const n = (y1 - y0) * (x1 - x0), d = (y * width + x) * 4;
        for (let c = 0; c < 4; c += 1) out[d + c] = Math.round(sum[c] / n);
      }
    }
    return { width, height, data: out };
  }
  for (let y = 0; y < height; y += 1) {
    const fy = Math.min(image.height - 1, Math.max(0, (y + 0.5) * sy - 0.5)), y0 = Math.floor(fy), y1 = Math.min(image.height - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < width; x += 1) {
      const fx = Math.min(image.width - 1, Math.max(0, (x + 0.5) * sx - 0.5)), x0 = Math.floor(fx), x1 = Math.min(image.width - 1, x0 + 1), wx = fx - x0;
      const a = (y0 * image.width + x0) * 4, b = (y0 * image.width + x1) * 4, c = (y1 * image.width + x0) * 4, e = (y1 * image.width + x1) * 4, d = (y * width + x) * 4;
      for (let k = 0; k < 4; k += 1) out[d + k] = Math.round((src[a + k] * (1 - wx) + src[b + k] * wx) * (1 - wy) + (src[c + k] * (1 - wx) + src[e + k] * wx) * wy);
    }
  }
  return { width, height, data: out };
}

/** Crop a rectangle out of `image`. */
export function cropImage(image, { x, y, width, height }) {
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const s = ((y + row) * image.width + x) * 4;
    out.set(image.data.subarray(s, s + width * 4), row * width * 4);
  }
  return { width, height, data: out };
}

/** Alpha-composite `top` over `base` (mutated) with its top-left corner at (x, y); pixels outside `base` are dropped. */
export function drawOver(base, top, x, y) {
  for (let row = 0; row < top.height; row += 1) {
    const by = y + row;
    if (by < 0 || by >= base.height) continue;
    for (let col = 0; col < top.width; col += 1) {
      const bx = x + col;
      if (bx < 0 || bx >= base.width) continue;
      const s = (row * top.width + col) * 4, d = (by * base.width + bx) * 4, a = top.data[s + 3];
      if (a === 255) { base.data[d] = top.data[s]; base.data[d + 1] = top.data[s + 1]; base.data[d + 2] = top.data[s + 2]; base.data[d + 3] = 255; continue; }
      if (a === 0) continue;
      const alpha = a / 255, beneath = base.data[d + 3] / 255, outA = alpha + beneath * (1 - alpha);
      for (let c = 0; c < 3; c += 1) base.data[d + c] = Math.round((top.data[s + c] * alpha + base.data[d + c] * beneath * (1 - alpha)) / (outA || 1));
      base.data[d + 3] = Math.round(outA * 255);
    }
  }
  return base;
}

/** Darken every pixel of `image` (mutated) by a black scrim of opacity `amount` in [0, 1]. */
export function dimImage(image, amount) {
  const keep = 1 - amount;
  for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c += 1) image.data[i + c] = Math.round(image.data[i + c] * keep);
  return image;
}

/**
 * The bounding rectangle of the pixels matching `key` ([r, g, b], within `tolerance` per channel), and how much
 * of that rectangle they fill. A capture or a drawn layout marks its page slot with one flat key colour, so the
 * slot is measured from the image rather than typed in.
 */
export function keyRect(image, key = [255, 0, 255], tolerance = 8) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0;
  const hits = (i) => Math.abs(image.data[i] - key[0]) <= tolerance && Math.abs(image.data[i + 1] - key[1]) <= tolerance && Math.abs(image.data[i + 2] - key[2]) <= tolerance && image.data[i + 3] > 200;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    if (!hits((y * image.width + x) * 4)) continue;
    count += 1;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (!count) return null;
  const rect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return { rect, fill: count / (rect.width * rect.height) };
}
