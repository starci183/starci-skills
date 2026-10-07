import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../engine/yaml.mjs';
import {sha256File} from '../../../engine/digest.mjs';
import {resolveBlob,getBlob} from '../../../engine/db/blob.mjs';
import {slash} from '../../lib/path-key.mjs';

const MIN_VIDEO_BYTES = 10_000;
const MIN_SCREEN_BYTES = 5_000;
const HEAD_BYTES = 64;
const SIGNATURES = [
  {ext:'.png',name:'PNG',starts:Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])},
  {ext:'.jpg',name:'JPEG',starts:Buffer.from([0xff,0xd8])},
  {ext:'.jpeg',name:'JPEG',starts:Buffer.from([0xff,0xd8])},
  {ext:'.webp',name:'RIFF/WEBP',starts:Buffer.from('RIFF','ascii'),tagAt:8,tag:'WEBP'},
  {ext:'.gif',name:'GIF8',starts:Buffer.from('GIF8','latin1')},
  {ext:'.webm',name:'Matroska/WebM (EBML)',starts:Buffer.from([0x1a,0x45,0xdf,0xa3])},
  {ext:'.mp4',name:'ISO base-media ftyp box',boxTag:'ftyp'},
];

function headOf(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(Math.min(HEAD_BYTES, size));
    return head.subarray(0, fs.readSync(fd, head, 0, head.length, 0));
  } finally { fs.closeSync(fd); }
}

function signatureProblem(file, head) {
  const ext = path.extname(file).toLowerCase();
  const expected = SIGNATURES.find(entry => entry.ext === ext);
  if (!expected) return null;
  if (expected.boxTag) {
    const seen = head.subarray(4, 8).toString('latin1');
    if (seen === expected.boxTag) return null;
    return `bytes 4-7 open an "${seen || '(too short)'}" box where a ${ext} file must carry ${expected.boxTag}`;
  }
  const prefix = head.subarray(0, expected.starts.length);
  const tagOk = !expected.tag || head.subarray(expected.tagAt, expected.tagAt + 4).toString('ascii') === expected.tag;
  if (prefix.equals(expected.starts) && tagOk) return null;
  const asText = slash(head.subarray(0, 24).toString('utf8')).replace(/[^\x20-\x7e]/g, '.');
  return `its first bytes are ${prefix.toString('hex')}${head.length ? ' ("' + asText + '")' : ' - the file is empty'}, not ${expected.name} (${expected.starts.toString('hex')})`;
}

function verifyCitation(found, docFile, ctx, sink, seen) {
  const {text, entry} = found;
  const named = `blob citation ${text}`;
  const stamped = typeof entry.sha256 === 'string' ? entry.sha256.trim().toLowerCase() : '';
  if (!/^[0-9a-f]{64}$/.test(stamped) || (ctx.blobOptions?.root != null && entry.sha256 !== stamped)) {
    sink.refuse(docFile, 'ASSET_STAMP', `${found.trail} cites ${named} with sha256 ${JSON.stringify(entry.sha256)}, which is not a sha256 - the citation resolves nothing`);
    return;
  }
  const blobOptions = ctx.blobOptions ?? {};
  let hit, selectedBytes = null;
  try {
    hit = resolveBlob({sha256: stamped}, blobOptions);
    if (hit && blobOptions.root != null) selectedBytes = getBlob(stamped, {...blobOptions, verifyBundle: true});
  } catch (error) {
    sink.refuse(docFile, error.code === 'EINVALBUNDLE' ? 'ASSET_BUNDLE' : 'ASSET_STORE', `${found.trail} cites ${named}, whose selected bytes cannot be verified: ${error.message}`);
    return;
  }
  if (!hit || !fs.existsSync(hit.file)) {
    sink.refuse(docFile, 'ASSET_MISSING', `${found.trail} cites ${named} (${stamped.slice(0, 12)}), which is not in its selected blob store - declared bytes are not there`);
    return;
  }
  if (seen) { seen.filesOpened += 1; seen.digestsCompared += 1; }
  const size = selectedBytes === null ? fs.statSync(hit.file).size : selectedBytes.length;
  if (!size) {
    sink.refuse(docFile, 'ASSET_EMPTY', `${found.trail} cites ${named}, which is a 0-byte blob`);
    return;
  }
  const actual = selectedBytes === null ? sha256File(hit.file) : stamped; // getBlob verified these exact selected bytes
  if (actual !== stamped) sink.refuse(docFile, 'ASSET_DIGEST', `${found.trail} cites ${named} as ${stamped}, but the stored blob hashes to ${actual}`);
}

function missingDeclaration(found, docFile, rule, named, sink) {
  if (!fs.existsSync(found.abs)) {
    const message = `${rule.trail} names ${named}, which is not on disk under ${found.base}`;
    if (rule.what === 'input') sink.suspect(docFile, 'EVIDENCE_ARTIFACT_GHOST', `${message} - a declared input the Work tree does not keep`);
    else sink.refuse(docFile, 'ASSET_MISSING', `${message} - declared bytes are not there`);
    return true;
  }
  return false;
}

function nonRegularDeclaration(found, docFile, rule, named, sink) {
  if (!fs.lstatSync(found.abs).isFile()) {
    sink.refuse(docFile, 'ASSET_MISSING', `${rule.trail} names ${named}, which is not a regular file`);
    return true;
  }
  return false;
}

function emptyDeclaration(found, docFile, rule, named, size, sink) {
  if (size === 0) {
    sink.refuse(docFile, 'ASSET_EMPTY', `${rule.trail} names ${named}, which exists as a 0-byte placeholder`);
    return true;
  }
  return false;
}

function verifyDeclarationDigest(found, docFile, rule, named, size, sink, seen) {
  if (found.digest == null) return;
  const stamped = typeof found.digest === 'string' ? found.digest.trim() : String(found.digest);
  if (!/^[0-9a-f]{64}$/.test(stamped.toLowerCase())) {
    sink.refuse(docFile, 'ASSET_STAMP', `${rule.trail} stamps ${named} as ${JSON.stringify(found.digest)}, which is not a sha256 - there is nothing to verify the bytes against`);
    return;
  }
  if (seen) seen.digestsCompared += 1;
  const actual = sha256File(found.abs);
  if (actual === stamped.toLowerCase()) return;
  const moved = `${rule.trail} stamps ${named} as ${stamped}, but the ${size} bytes on disk hash to ${actual}`;
  if (rule.what === 'input') sink.suspect(docFile, 'INPUT_BYTES_MOVED', `${moved} - what this artifact was drawn from is not what its provenance says it was`);
  else sink.refuse(docFile, 'ASSET_DIGEST', `${moved} - the bytes on disk are not the bytes this declaration names`);
}

/** Verify one declaration in the original order: location, file type, size, signature, then digest. */
export function verifyDeclaration(found, docFile, ctx, sink, seen) {
  const {rule, text} = found;
  const named = `${rule.what === 'asset' ? 'artifact' : rule.what} ${text}`;
  if (seen) seen.declarations += 1;
  if (found.citation) return verifyCitation(found, docFile, ctx, sink, seen);
  if (missingDeclaration(found, docFile, rule, named, sink)) return;
  if (nonRegularDeclaration(found, docFile, rule, named, sink)) return;
  const size = fs.statSync(found.abs).size;
  if (seen) seen.filesOpened += 1;
  if (emptyDeclaration(found, docFile, rule, named, size, sink)) return;
  const signature = signatureProblem(found.abs, headOf(found.abs, size));
  if (signature) {
    sink.refuse(docFile, 'ASSET_MAGIC', `${rule.trail} names ${named}, but ${signature}`);
    return;
  }
  verifyDeclarationDigest(found, docFile, rule, named, size, sink, seen);
}

function checkRunMediaFile(file, folder, floor, kind, settled, sink, seen) {
  if (seen) seen.mediaFiles += 1;
  const size = fs.statSync(file).size;
  if (!size) {
    sink.refuse(file, 'ASSET_EMPTY', `${folder}/ keeps a 0-byte ${kind} - a name in a list is not a ${kind}`);
    return;
  }
  const problem = signatureProblem(file, headOf(file, size));
  if (problem) sink.refuse(file, 'ASSET_MAGIC', `${folder}/ keeps a ${kind} that is not one: ${problem}`);
  if (size >= floor) return;
  const message = `${folder}/${path.basename(file)} is ${size}B, under the ${floor}B floor a real ${kind} clears`;
  if (settled) sink.refuse(file, 'RUN_MEDIA_FAKE', `${message} - this is the run the evidence settled on, so its proof cannot hold`);
  else sink.suspect(file, 'RUN_MEDIA_FAKE', `${message} - a stub kept in an unsettled run`);
}

export function checkRunMedia(runDir, settled, sink, seen, walk) {
  const filesIn = dir => fs.existsSync(dir) && fs.lstatSync(dir).isDirectory() ? walk(dir) : [];
  const groups = [['videos', filesIn(path.join(runDir, 'videos')), MIN_VIDEO_BYTES, 'video'],
    ['screens', filesIn(path.join(runDir, 'screens')), MIN_SCREEN_BYTES, 'screenshot']];
  for (const [folder, files, floor, kind] of groups) {
    for (const file of files) checkRunMediaFile(file, folder, floor, kind, settled, sink, seen);
  }
}

function checkReceiptCall(call, receiptFile, sink) {
  const basename = typeof call?.toolOutputBasename === 'string' ? call.toolOutputBasename.trim() : '';
  if (!basename) {
    if (call?.artifact) sink.suspect(receiptFile, 'RECEIPT_ORPHAN', `a call names artifact ${call.artifact} with no toolOutputBasename - the copy step is unattributed`);
    return;
  }
  const from = path.extname(basename).toLowerCase();
  const to = path.extname(String(call?.artifact ?? '')).toLowerCase();
  if (to && from !== to) {
    sink.refuse(receiptFile, 'RECEIPT_ORPHAN', `the tool produced ${basename} and the record kept ${call.artifact} - ${from} bytes renamed to ${to} are not the same artifact`);
  }
}

export function checkReceipt(receiptFile, ctx, sink, seen, {declarationsOf, receiptDeclarations}) {
  const doc = parseYaml(fs.readFileSync(receiptFile, 'utf8'));
  if (!doc || typeof doc !== 'object') return;
  const receiptCtx = {...ctx, recordDir: ctx.ownerDirOf(receiptFile) ?? path.dirname(path.dirname(receiptFile))};
  for (const found of declarationsOf(doc, receiptDeclarations, receiptCtx)) {
    if (found.digest && seen) seen.digests += 1;
    verifyDeclaration(found, receiptFile, receiptCtx, sink, seen);
  }
  const calls = Array.isArray(doc.calls) ? doc.calls : [];
  if (seen) seen.receiptCalls += calls.length;
  for (const call of calls) checkReceiptCall(call, receiptFile, sink);
}
