import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { blobPath, getBlob, statBlob } from '../../../engine/db/blob.mjs';
import { isTextMedia } from '../../../scripts/lib/redact.mjs';
import { MAX_BUFFERED_TEXT, decodeText, redactUnmarkedText, redactTextStream, publicJson, textEncodingOf } from '../redact-read.mjs';
import { sendError } from '../envelope.mjs';

function findRow(store, sha) {
  const machine = store.machine?.db.prepare('SELECT sha256,media_type,redaction,archived_at,archive_ref FROM blobs WHERE sha256=?').get(sha);
  if (machine) return machine;
  for (const result of store.forEachLedger(({db}) => db.prepare('SELECT sha256,media_type,redaction,archived_at,archive_ref FROM blobs WHERE sha256=?').get(sha))) if (result.result) return result.result;
  return null;
}

const NO_RANGE = Object.freeze({ present: false, valid: true });
const BAD_RANGE = Object.freeze({ present: true, valid: false });

// `first`/`last` are the digits around the dash; a missing `first` makes `last` a suffix length.
function rangeBounds(first, last, length) {
  if (first == null) {
    if (!Number.isInteger(last) || last < 1) return null;
    return { start: Math.max(0, length - last), end: length - 1 };
  }
  return { start: first, end: last == null ? length - 1 : Math.min(last, length - 1) };
}

function rangeOf(value, length) {
  if (!value) return NO_RANGE;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m) return BAD_RANGE;
  const bounds = rangeBounds(m[1] ? Number(m[1]) : null, m[2] ? Number(m[2]) : null, length);
  if (!bounds) return BAD_RANGE;
  const { start, end } = bounds;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= length) return BAD_RANGE;
  return { present: true, valid: true, start, end };
}

async function redactedLength(file) {
  let length = 0;
  for await (const chunk of createReadStream(file).pipe(redactTextStream())) length += chunk.length;
  return length;
}

function redactedRange(start, end) {
  let offset = 0;
  return new Transform({ transform(chunk, _encoding, callback) {
    const from = Math.max(0, start - offset);
    const to = Math.min(chunk.length, end + 1 - offset);
    if (to > from) this.push(chunk.subarray(from, to));
    offset += chunk.length;
    callback();
  } });
}

function sendUnavailable(request, response, row) {
  if (!row.archived_at) return sendError(request, response, 404, 'NOT_FOUND', 'Blob bytes unavailable');
  const error = { error: { code: 'ARCHIVED', message: 'Blob archived', archiveRef: publicJson(row.archive_ref) } };
  response.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(error));
}

// A v1 write marker proves secret filtering ran, but older evidence can still
// contain absolute paths. Check small marked text before serving stored bytes.
function readPlanOf(sha, row, metadata) {
  const textMedia = isTextMedia(row.media_type);
  const unmarked = row.redaction == null && textMedia;
  const storedText = textMedia && !unmarked && metadata.size <= MAX_BUFFERED_TEXT ? getBlob(sha) : null;
  const safeText = storedText ? redactUnmarkedText(storedText) : null;
  const changedText = Boolean(safeText && !safeText.equals(storedText));
  return { textMedia, unmarked, storedText, safeText, changedText, readRedaction: unmarked || changedText || (textMedia && !storedText) };
}

function previewRefusal(mode, plan, metadata) {
  if (!mode) return null;
  if (!['head', 'tail'].includes(mode)) return [400, 'INVALID_PREVIEW', 'Invalid text preview'];
  if (!plan.textMedia) return [400, 'NOT_TEXT', 'Blob is not text'];
  if (metadata.size > (plan.readRedaction ? MAX_BUFFERED_TEXT : 8 * MAX_BUFFERED_TEXT)) return [413, 'PREVIEW_TOO_LARGE', 'Text preview exceeds the safe size limit'];
  return null;
}

function previewBytes(sha, plan, mode, url) {
  const bytes = plan.unmarked ? redactUnmarkedText(getBlob(sha)) : plan.safeText ?? Buffer.from(decodeText(getBlob(sha)));
  const lines = Math.min(2000, Math.max(1, Number(url.searchParams.get('lines')) || 200));
  const content = bytes.toString('utf8').split(/\r?\n/);
  return Buffer.from((mode === 'head' ? content.slice(0, lines) : content.slice(-lines)).join('\n'));
}

function contentTypeOf(row, plan, mode) {
  if (mode) return 'text/plain; charset=utf-8';
  if (plan.textMedia && plan.readRedaction && !/charset=/i.test(row.media_type)) return `${row.media_type}; charset=utf-8`;
  return row.media_type;
}

function headersOf({ row, plan, mode, url, sha, etag }) {
  const sourceEncoding = plan.storedText ? textEncodingOf(plan.storedText) : null;
  const headers = {'Content-Type':contentTypeOf(row,plan,mode),...(sourceEncoding&&sourceEncoding!=='utf-8'?{'X-StarCi-Source-Encoding':sourceEncoding}:{}),'Cache-Control':plan.readRedaction?'no-store':'public, max-age=31536000, immutable',...(etag?{'ETag':etag}:{}),'Accept-Ranges':'bytes','Content-Disposition':url.searchParams.get('download')==='1'?`attachment; filename="${sha}.txt"`:'inline','X-Content-Type-Options':'nosniff'};
  if (plan.readRedaction) headers['X-StarCi-Redacted'] = plan.changedText ? 'read-v1' : 'stream-v1';
  return headers;
}

async function lengthOf({ request, file, bytes, streaming, metadata }) {
  if (bytes) return bytes.length;
  return streaming && (request.method === 'HEAD' || request.headers.range) ? await redactedLength(file) : metadata.size;
}

function lengthHeaders({ range, streaming, head, start, end, length }) {
  const out = {};
  if (!(streaming && !head && !range.present)) out['Content-Length'] = Math.max(0, end - start + 1);
  if (range.present) out['Content-Range'] = `bytes ${start}-${end}/${length}`;
  return out;
}

async function sendBody({ response, head, bytes, streaming, range, file, start, end }) {
  if (head) { response.end(); return; }
  if (bytes) { response.end(bytes.subarray(start, end + 1)); return; }
  if (streaming) {
    if (range.present) await pipeline(createReadStream(file), redactTextStream(), redactedRange(start, end), response);
    else await pipeline(createReadStream(file), redactTextStream(), response);
    return;
  }
  createReadStream(file, { start, end }).on('error', () => response.destroy()).pipe(response);
}

export async function blob(request,response,store,url,sha) {
  if (!/^[a-f0-9]{64}$/.test(sha)) return sendError(request,response,400,'INVALID_SHA','Invalid blob identifier');
  const row = findRow(store,sha);
  if (!row) return sendError(request,response,404,'NOT_FOUND','Blob not found');
  const file = blobPath(sha);
  if (!file) return sendUnavailable(request,response,row);
  const metadata = statBlob(sha);
  const plan = readPlanOf(sha,row,metadata);
  const mode = url.searchParams.get('text');
  const refusal = previewRefusal(mode,plan,metadata);
  if (refusal) return sendError(request,response,...refusal);
  let bytes = plan.changedText ? plan.safeText : null;
  const streaming = plan.readRedaction && !plan.changedText && !mode;
  if (mode) bytes = previewBytes(sha,plan,mode,url);
  const length = await lengthOf({ request, file, bytes, streaming, metadata });
  const etag = plan.readRedaction ? null : `"${sha}"`;
  const headers = headersOf({ row, plan, mode, url, sha, etag });
  if (etag && request.headers['if-none-match']===etag) {response.writeHead(304,headers);response.end();return;}
  const range = rangeOf(request.headers.range,length);
  if (!range.valid) {response.writeHead(416,{...headers,'Content-Range':`bytes */${length}`});response.end();return;}
  const start = range.start ?? 0, end = range.end ?? length-1;
  const head = request.method==='HEAD';
  response.writeHead(range.present?206:200,{...headers,...lengthHeaders({range,streaming,head,start,end,length})});
  await sendBody({ response, head, bytes, streaming, range, file, start, end });
}
