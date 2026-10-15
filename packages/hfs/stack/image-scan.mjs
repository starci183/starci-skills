// image-scan.mjs - the guard before a PUBLIC image is pushed: layers of a public package are public, so the built image is scanned for secret material
// and the push is refused on any hit. Three sources, all read from the local docker daemon (no registry, no credentials):
//   history      the build instructions (docker history): secret patterns, and build arguments that are not on the public build-args list
//   environment  the baked ENV: secret patterns, and non-empty values of variables named like a secret
//   filesystem   the exported container filesystem (a tar, read by header): files named like secret material outside the library directories, and the
//                content of small text files for secret patterns
// A hit names the rule and the place (a path, a history line, a variable NAME), never the matched text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { firstLine, lines as splitLines, tool } from './context.mjs';

const SECRET_PATTERNS = [
  ['a private key block', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/u],
  ['an age secret key', /AGE-SECRET-KEY-1[0-9A-Z]{20,}/u],
  ['a sealed secret envelope', /ENC\[AES256_GCM,/u],
  ['sops metadata', /"sops"\s*:\s*\{|^sops:\s*$/mu],
  ['a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u],
  ['an AWS access key id', /\bAKIA[0-9A-Z]{16}\b/u],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/u],
  ['a live API key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}/u],
];
const SECRET_NAME = /(?:SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY)/iu;
const SECRET_FILE = /(?:^|\/)(?:\.env(?!\.(?:example|sample|template)$)[^/]*|secrets?\.env|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx|jks|enc)|\.npmrc|\.netrc|\.git-credentials|\.sops\.yaml|keys\.txt)$/u;
/** Directories whose files are libraries or the base system, not the app: test certificates and sample keys live there by design. */
const LIBRARY_DIR = /^(?:usr\/(?:share|lib|local\/lib|include)|etc\/(?:ssl|ca-certificates|pki)|lib|var\/lib|opt\/yarn|root\/\.(?:npm|cache)|home\/[^/]+\/\.(?:npm|cache)|(?:[^/]+\/)*node_modules)(?:\/|$)/u;
const TEXT_FILE = /\.(?:[cm]?js|ts|json|ya?ml|env|txt|conf|cfg|ini|sh|toml|properties|md)$/u;
const MAX_TEXT_BYTES = 128 * 1024;
const BLOCK = 512;
const BUILD_ARG_PREFIX = /^\|\d+ ((?:[A-Za-z_][A-Za-z0-9_]*=\S*\s?)+)/u;
const ARG_INSTRUCTION = /\bARG\s+([A-Za-z_][A-Za-z0-9_]*)/gu;

const cleanName = (name) => name.replace(/^\.?\//u, '').replace(/\/$/u, '');
const secretPatternIn = (text) => SECRET_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

/** Reads one NUL-terminated field of a tar header. */
const field = (header, from, length) => header.toString('utf8', from, from + length).replace(/\0.*$/su, '');

function sizeOf(header) {
  if (header[124] & 0x80) {
    let value = 0;
    for (let index = 125; index < 136; index += 1) value = (value * 256) + header[index];
    return value;
  }
  return Number.parseInt(field(header, 124, 12).trim() || '0', 8);
}

const paxPath = (body) => body.toString('utf8').split('\n').map((record) => /^\d+ path=(.*)$/u.exec(record)).find(Boolean)?.[1] ?? null;

/**
 * Walks a tar file by header: calls visit({ name, type, size, read }) for every entry (`read()` returns the content, called only for files worth
 * reading). Handles ustar prefixes, GNU long names (L) and PAX paths (x). Content is never loaded unless the visitor asks for it.
 */
export function walkTar(file, visit) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(BLOCK);
    let position = 0;
    let pending = null;
    for (;;) {
      if (fs.readSync(fd, header, 0, BLOCK, position) < BLOCK || header.every((byte) => byte === 0)) return;
      const size = sizeOf(header);
      const type = String.fromCharCode(header[156] || 48);
      const prefix = field(header, 345, 155);
      const own = field(header, 0, 100);
      const contentAt = position + BLOCK;
      const read = () => { const body = Buffer.alloc(size); fs.readSync(fd, body, 0, size, contentAt); return body; };
      if (type === 'L' || type === 'x') {
        const body = read();
        pending = type === 'L' ? body.toString('utf8').replace(/\0.*$/su, '') : paxPath(body) ?? pending;
      } else {
        visit({ name: cleanName(pending ?? (prefix ? `${prefix}/${own}` : own)), type, size, read });
        pending = null;
      }
      position = contentAt + (Math.ceil(size / BLOCK) * BLOCK);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function historyHits(historyText, allowedArgs) {
  const hits = [];
  splitLines(historyText).forEach((line, index) => {
    const found = secretPatternIn(line);
    if (found) hits.push({ kind: 'history', where: `history line ${index + 1}`, why: found });
    const names = [...(BUILD_ARG_PREFIX.exec(line)?.[1].trim().split(/\s+/u).map((pair) => pair.split('=')[0]) ?? []), ...[...line.matchAll(ARG_INSTRUCTION)].map((match) => match[1])];
    for (const name of new Set(names)) if (!allowedArgs.has(name)) hits.push({ kind: 'build-arg', where: `history line ${index + 1}`, why: `build argument ${name} is not on the public build-args list` });
  });
  return hits;
}

function environmentHits(envJson) {
  let values = [];
  try { values = JSON.parse(envJson); } catch { values = []; }
  return (Array.isArray(values) ? values : []).flatMap((entry) => {
    const at = String(entry).indexOf('=');
    const name = String(entry).slice(0, at);
    const value = String(entry).slice(at + 1);
    const found = secretPatternIn(value);
    if (found) return [{ kind: 'env', where: `environment variable ${name}`, why: found }];
    return SECRET_NAME.test(name) && value !== '' ? [{ kind: 'env', where: `environment variable ${name}`, why: 'a variable named like a secret holds a value' }] : [];
  });
}

function fileHits(tarFile) {
  const hits = [];
  walkTar(tarFile, ({ name, type, size, read }) => {
    if (!['0', '7'].includes(type) || LIBRARY_DIR.test(name)) return;
    if (SECRET_FILE.test(name)) hits.push({ kind: 'file', where: name, why: 'a file named like secret material' });
    else if (TEXT_FILE.test(name) && size > 0 && size <= MAX_TEXT_BYTES) {
      const found = secretPatternIn(read().toString('utf8'));
      if (found) hits.push({ kind: 'content', where: name, why: found });
    }
  });
  return hits;
}

/** The filesystem of the image as a tar file (create, export to a file, remove), or an error line. */
function exportFilesystem(ctx, ref, directory) {
  const created = tool(ctx, 'docker', ['create', ref]);
  const id = firstLine(created.stdout);
  if (created.status !== 0 || id === '') return { error: `docker create failed: ${firstLine(created.stderr)}` };
  const tarFile = path.join(directory, 'filesystem.tar');
  const exported = tool(ctx, 'docker', ['export', '-o', tarFile, id]);
  tool(ctx, 'docker', ['rm', '-f', id]);
  return exported.status === 0 ? { tarFile } : { error: `docker export failed: ${firstLine(exported.stderr)}` };
}

/**
 * Scans a built image. `allowedArgs` = the names of the public build arguments that were passed. Returns { ok, hits, errors }:
 * errors are scan steps that could not run (the push is refused too: an unscanned public image is not pushed).
 */
export function scanImage(ctx, ref, { allowedArgs }) {
  const hits = [];
  const errors = [];
  const history = tool(ctx, 'docker', ['history', '--no-trunc', '--format', '{{.CreatedBy}}', ref]);
  if (history.status === 0) hits.push(...historyHits(history.stdout, new Set(allowedArgs)));
  else errors.push(`docker history failed: ${firstLine(history.stderr)}`);
  const environment = tool(ctx, 'docker', ['inspect', '--format', '{{json .Config.Env}}', ref]);
  if (environment.status === 0) hits.push(...environmentHits(environment.stdout));
  else errors.push(`docker inspect failed: ${firstLine(environment.stderr)}`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-scan-'));
  try {
    const exported = exportFilesystem(ctx, ref, directory);
    if (exported.error) errors.push(exported.error);
    else hits.push(...fileHits(exported.tarFile));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  return { ok: hits.length === 0 && errors.length === 0, hits, errors };
}
