// assets.mjs - R282: small build-time binaries belong in be.assets; user media, model weights and datasets do not belong in git.
// The owner assets policy has no numeric cap yet. 512000 bytes follows the existing repo.docs-media budget in slots.yaml;
// ruleParams.be.assets {bytes (or maxBytes), extensions} supplies a manifest's explicit cap and build-time extension allowlist.
import fs from 'node:fs';
import path from 'node:path';
import { editionRuleParams } from '../edition-slots.mjs';
import { found } from './read.mjs';

export const HFS_ASSET_OVERSIZE = 'HFS_ASSET_OVERSIZE';
export const HFS_ASSET_KIND = 'HFS_ASSET_KIND';
const DEFAULT_ASSET_BYTES = 512000;
const BUILD_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2', '.eot', '.png', '.svg', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.avif', '.bmp', '.tif', '.tiff'];
const MEDIA_EXTENSIONS = new Set(['.mp3', '.mp4', '.wav', '.ogg', '.oga', '.opus', '.flac', '.aac', '.m4a', '.wma', '.aiff', '.aif', '.mid', '.midi', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.mpeg', '.mpg', '.wmv', '.flv', '.3gp']);
const IMAGE_EXTENSIONS = new Set(BUILD_EXTENSIONS.filter((ext) => !['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)));
const MODEL_EXTENSIONS = new Set(['.onnx', '.pt', '.pth', '.ckpt', '.safetensors', '.gguf', '.ggml', '.tflite', '.keras', '.caffemodel', '.h5', '.hdf5', '.npy', '.npz', '.pkl', '.pickle', '.joblib', '.weights']);
const DATASET_EXTENSIONS = new Set(['.parquet', '.arrow', '.feather', '.avro', '.tfrecord', '.tfrecords', '.jsonl', '.ndjson']);
const COMPRESSED = /\.(?:gz|bz2|xz|zst|zip|tar|tgz)$/i;
const SOURCE_OR_DOC = /\.(?:[cm]?[jt]sx?|md|mdx|rst)$/i;
const DATA_DIRECTORY = /(?:^|\/)(?:datasets?|training-data|training-set|weights|checkpoints)(?:\/|$)/i;
const MODEL_DIRECTORY = /(?:^|\/)models?(?:\/|$)/i;
const DOCS_MEDIA = /^docs\/.+\.(?:png|svg|webp)$/i;
const USER_ASSET_DIRECTORY = /^src\/assets\/(?:media|uploads?|music|audio|videos?)(?:\/|$)/i;
const MODEL_BINARY = /(?:^|\/)(?:[^/]*[-_.])?(?:model|weights|checkpoint)(?:[-_.][^/]*)?\.bin$/i;

function assetPolicy(manifest, edition) {
  const config = editionRuleParams(manifest?.ruleParams?.be ?? {}, edition).assets ?? {};
  const cap = config.bytes ?? config.maxBytes;
  const bytes = Number.isSafeInteger(cap) && cap > 0 ? cap : DEFAULT_ASSET_BYTES;
  const extensions = Array.isArray(config.extensions) ? config.extensions : BUILD_EXTENSIONS;
  return { bytes, extensions: new Set(extensions.filter((ext) => typeof ext === 'string').map((ext) => `.${ext.replace(/^\./, '').toLowerCase()}`)) };
}

function uncompressedName(file) {
  let name = file;
  while (COMPRESSED.test(name)) name = name.replace(COMPRESSED, '');
  return name;
}

function refusedKind(file, extensions) {
  const name = uncompressedName(file);
  const ext = path.posix.extname(name).toLowerCase();
  const asset = file.startsWith('src/assets/');
  if (MODEL_EXTENSIONS.has(ext) || MODEL_BINARY.test(name) || (ext === '.bin' && MODEL_DIRECTORY.test(file))) return 'model weights';
  if (DATASET_EXTENSIONS.has(ext)) return 'a dataset or model artifact';
  // repo.docs-media owns these images even when their subject is a dataset, weights or checkpoints.
  if (DOCS_MEDIA.test(file)) return null;
  if (DATA_DIRECTORY.test(file) && !SOURCE_OR_DOC.test(file)) return 'a dataset or model artifact';
  if (MEDIA_EXTENSIONS.has(ext) || USER_ASSET_DIRECTORY.test(file)) return 'user media';
  if (asset) {
    if (!/^src\/assets\/[^/]+\/.+/.test(file)) return 'an asset outside a per-kind folder';
    if (!extensions.has(path.posix.extname(file).toLowerCase())) return 'an asset extension outside ruleParams.be.assets.extensions';
  } else if (IMAGE_EXTENSIONS.has(ext)) return 'media outside be.assets';
  return null;
}

function fileBytes(repoRoot, file) {
  try {
    const stat = fs.lstatSync(path.join(repoRoot, file));
    return stat.isFile() ? stat.size : null;
  } catch { return null; }
}

/** Side-relative tracked paths only: the app root and FE are left to their own rules, avoiding duplicate root/side findings. */
export function assetsFindings({ repoRoot, files = [], repo, manifest, isRoot = false, inScope = () => true }) {
  const edition = repo?.edition ?? 'full';
  if (isRoot || repo?.profile !== 'be' || !['lite', 'full'].includes(edition)) return [];
  const policy = assetPolicy(manifest, edition);
  const findings = [];
  for (const raw of new Set(files)) {
    if (!inScope(raw)) continue;
    const file = raw.replaceAll('\\', '/');
    const kind = refusedKind(file, policy.extensions);
    if (kind) findings.push(found(HFS_ASSET_KIND, file, `${file} is ${kind}; keep only small build-time binaries in src/assets/<kind>/, put user media in object storage, and keep model weights and datasets outside git`));
    if (!file.startsWith('src/assets/')) continue;
    const bytes = fileBytes(repoRoot, file);
    if (bytes !== null && bytes > policy.bytes) findings.push(found(HFS_ASSET_OVERSIZE, file, `${file} is ${bytes} bytes, above the ${policy.bytes}-byte per-file build-time asset budget; store it externally and fetch it at runtime`, { bytes, maxBytes: policy.bytes }));
  }
  return findings;
}
