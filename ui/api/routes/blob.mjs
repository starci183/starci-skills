import { createReadStream } from 'node:fs';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { blobPath, getBlob, statBlob } from '../../../scripts/lib/artifact-store.mjs';
import { isTextMedia } from '../../../scripts/lib/redact.mjs';
import { MAX_BUFFERED_TEXT, decodeText, redactUnmarkedText, redactTextStream, publicJson, textEncodingOf } from '../redact-read.mjs';
import { sendError } from '../envelope.mjs';

function findRow(store, sha) {
  const machine = store.machine?.db.prepare('SELECT sha256,media_type,redaction,archived_at,archive_ref FROM blobs WHERE sha256=?').get(sha);
  if (machine) return machine;
  for (const result of store.forEachLedger(({db}) => db.prepare('SELECT sha256,media_type,redaction,archived_at,archive_ref FROM blobs WHERE sha256=?').get(sha))) if (result.result) return result.result;
  return null;
}

function rangeOf(value, length) {
  if (!value) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m) return false;
  let start = m[1] ? Number(m[1]) : null;
  let end = m[2] ? Number(m[2]) : null;
  if (start == null) { const suffix = end; if (!Number.isInteger(suffix) || suffix < 1) return false; start = Math.max(0,length-suffix); end = length-1; }
  else end = end == null ? length-1 : Math.min(end,length-1);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start<0 || end<start || start>=length) return false;
  return {start,end};
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

export async function blob(request,response,store,url,sha) {
  if (!/^[a-f0-9]{64}$/.test(sha)) return sendError(request,response,400,'INVALID_SHA','Invalid blob identifier');
  const row = findRow(store,sha);
  if (!row) return sendError(request,response,404,'NOT_FOUND','Blob not found');
  const file = blobPath(sha);
  if (!file) {
    if (row.archived_at) {
      const error = { error:{code:'ARCHIVED',message:'Blob archived',archiveRef:publicJson(row.archive_ref)} };
      response.writeHead(410,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      response.end(request.method==='HEAD'?undefined:JSON.stringify(error));
      return;
    }
    return sendError(request,response,404,'NOT_FOUND','Blob bytes unavailable');
  }
  const metadata = statBlob(sha);
  const textMedia = isTextMedia(row.media_type);
  const unmarked = row.redaction == null && textMedia;
  // A v1 write marker proves secret filtering ran, but older evidence can still
  // contain absolute paths. Check small marked text before serving stored bytes.
  const storedText = textMedia && !unmarked && metadata.size <= MAX_BUFFERED_TEXT ? getBlob(sha) : null;
  const safeText = storedText ? redactUnmarkedText(storedText) : null;
  const changedText = Boolean(safeText && !safeText.equals(storedText));
  const readRedaction = unmarked || changedText || (textMedia && !storedText);
  const mode = url.searchParams.get('text');
  if (mode && !['head','tail'].includes(mode)) return sendError(request,response,400,'INVALID_PREVIEW','Invalid text preview');
  if (mode && !textMedia) return sendError(request,response,400,'NOT_TEXT','Blob is not text');
  if (mode && metadata.size > (readRedaction ? MAX_BUFFERED_TEXT : 8 * MAX_BUFFERED_TEXT)) return sendError(request,response,413,'PREVIEW_TOO_LARGE','Text preview exceeds the safe size limit');
  let bytes = changedText ? safeText : null;
  const streamingRedaction = readRedaction && !bytes && !mode;
  if (mode) {
    bytes = unmarked ? redactUnmarkedText(getBlob(sha)) : safeText ?? Buffer.from(decodeText(getBlob(sha)));
    const lines = Math.min(2000,Math.max(1,Number(url.searchParams.get('lines'))||200));
    const content = bytes.toString('utf8').split(/\r?\n/);
    bytes = Buffer.from((mode==='head'?content.slice(0,lines):content.slice(-lines)).join('\n'));
  }
  const length = bytes?.length ?? (streamingRedaction && (request.method === 'HEAD' || request.headers.range) ? await redactedLength(file) : metadata.size);
  const etag = readRedaction ? null : `"${sha}"`;
  const sourceEncoding = storedText ? textEncodingOf(storedText) : null;
  const headers = {'Content-Type':mode?'text/plain; charset=utf-8':textMedia&&readRedaction&&!/charset=/i.test(row.media_type)?`${row.media_type}; charset=utf-8`:row.media_type,...(sourceEncoding&&sourceEncoding!=='utf-8'?{'X-StarCi-Source-Encoding':sourceEncoding}:{}),'Cache-Control':readRedaction?'no-store':'public, max-age=31536000, immutable',...(etag?{'ETag':etag}:{}),'Accept-Ranges':'bytes','Content-Disposition':url.searchParams.get('download')==='1'?`attachment; filename="${sha}.txt"`:'inline','X-Content-Type-Options':'nosniff'};
  if (readRedaction) headers['X-StarCi-Redacted']=changedText?'read-v1':'stream-v1';
  if (etag && request.headers['if-none-match']===etag) {response.writeHead(304,headers);response.end();return;}
  const range = rangeOf(request.headers.range,length);
  if (range===false) {response.writeHead(416,{...headers,'Content-Range':`bytes */${length}`});response.end();return;}
  const start = range?.start ?? 0, end = range?.end ?? length-1;
  response.writeHead(range?206:200,{...headers,...(streamingRedaction && request.method !== 'HEAD' && !range?{}:{'Content-Length':Math.max(0,end-start+1)}),...(range?{'Content-Range':`bytes ${start}-${end}/${length}`}:{})});
  if (request.method==='HEAD') {response.end();return;}
  if (bytes) {response.end(bytes.subarray(start,end+1));return;}
  if (streamingRedaction) {
    if (range) await pipeline(createReadStream(file),redactTextStream(),redactedRange(start,end),response);
    else await pipeline(createReadStream(file),redactTextStream(),response);
    return;
  }
  createReadStream(file,{start,end}).on('error',()=>response.destroy()).pipe(response);
}
