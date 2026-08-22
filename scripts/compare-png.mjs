import {readFileSync} from "node:fs";
import {inflateSync} from "node:zlib";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

export function decodePng(file) {
  const bytes = readFileSync(file);
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error(`${file} is not a PNG capture`);
  let offset = 8;
  let header;
  const data = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset); offset += 4;
    const type = bytes.subarray(offset, offset + 4).toString("ascii"); offset += 4;
    const body = bytes.subarray(offset, offset + length); offset += length + 4;
    if (type === "IHDR") header = {width: body.readUInt32BE(0), height: body.readUInt32BE(4), bitDepth: body[8], colorType: body[9], interlace: body[12]};
    if (type === "IDAT") data.push(body);
    if (type === "IEND") break;
  }
  if (!header || !data.length) throw new Error(`${file} has no decodable PNG image`);
  if (header.bitDepth !== 8 || header.interlace !== 0 || ![0, 2, 4, 6].includes(header.colorType)) throw new Error(`${file} uses an unsupported PNG encoding`);
  const channels = ({0: 1, 2: 3, 4: 2, 6: 4})[header.colorType];
  const stride = header.width * channels;
  const raw = inflateSync(Buffer.concat(data));
  if (raw.length !== (stride + 1) * header.height) throw new Error(`${file} has an unexpected PNG scanline length`);
  const decoded = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const source = raw[y * (stride + 1) + x + 1];
      const left = x >= channels ? decoded[y * stride + x - channels] : 0;
      const up = y > 0 ? decoded[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0;
      const value = filter === 0 ? source
        : filter === 1 ? source + left
          : filter === 2 ? source + up
            : filter === 3 ? source + Math.floor((left + up) / 2)
              : filter === 4 ? source + paeth(left, up, upperLeft)
                : NaN;
      if (!Number.isFinite(value)) throw new Error(`${file} uses unknown PNG filter ${filter}`);
      decoded[y * stride + x] = value & 255;
    }
  }
  const rgba = Buffer.alloc(header.width * header.height * 4);
  for (let pixel = 0; pixel < header.width * header.height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    if (header.colorType === 0) rgba.set([decoded[source], decoded[source], decoded[source], 255], target);
    if (header.colorType === 2) rgba.set([decoded[source], decoded[source + 1], decoded[source + 2], 255], target);
    if (header.colorType === 4) rgba.set([decoded[source], decoded[source], decoded[source], decoded[source + 1]], target);
    if (header.colorType === 6) rgba.set(decoded.subarray(source, source + 4), target);
  }
  return {width: header.width, height: header.height, rgba};
}

const masked = (x, y, masks) => (masks ?? []).some((mask) => x >= mask.x && y >= mask.y && x < mask.x + mask.width && y < mask.y + mask.height);

export function comparePng(previewFile, sourceFile, thresholds) {
  const preview = decodePng(previewFile);
  const source = decodePng(sourceFile);
  if (preview.width !== source.width || preview.height !== source.height) throw new Error("preview and source captures have different pixel dimensions");
  for (const key of ["maxChangedRatio", "maxMeanDelta", "perPixelDelta"]) {
    if (!Number.isFinite(thresholds?.[key]) || thresholds[key] < 0) throw new Error(`visual threshold ${key} is missing or invalid`);
  }
  let compared = 0, changed = 0, deltaTotal = 0;
  for (let y = 0; y < preview.height; y += 1) for (let x = 0; x < preview.width; x += 1) {
    if (masked(x, y, thresholds.masks)) continue;
    const at = (y * preview.width + x) * 4;
    const delta = Math.max(...[0, 1, 2, 3].map((channel) => Math.abs(preview.rgba[at + channel] - source.rgba[at + channel]))) / 255;
    compared += 1;
    deltaTotal += delta;
    if (delta > thresholds.perPixelDelta) changed += 1;
  }
  if (compared === 0) throw new Error("visual masks exclude every pixel");
  const measurement = {width: preview.width, height: preview.height, comparedPixels: compared, changedPixels: changed, changedRatio: changed / compared, meanDelta: deltaTotal / compared};
  return {...measurement, passed: measurement.changedRatio <= thresholds.maxChangedRatio && measurement.meanDelta <= thresholds.maxMeanDelta};
}
