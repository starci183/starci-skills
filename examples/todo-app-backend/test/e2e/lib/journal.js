'use strict';

/**
 * The run journal. Every record written here describes a request this run really sent and the response
 * this run really got, with credential material redacted before anything is written to disk (the run is
 * disposable; the journal is not allowed to be a copy of its secrets).
 */

const fs = require('node:fs');
const path = require('node:path');

const REDACTED_KEYS = new Set([
  'sessiontoken',
  'authorization',
  'password',
  'access_token',
  'accesstoken',
  'refreshtoken',
  'keyid',
  'key',
  'secret',
]);

function redactValue(key, value) {
  if (REDACTED_KEYS.has(String(key).toLowerCase())) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return `[redacted ${text.length} chars]`;
  }
  return value;
}

/** Deep copy with every credential-shaped leaf replaced by a length-only stub. */
function redact(input, keyHint) {
  if (Array.isArray(input)) return input.map((item) => redact(item, keyHint));
  if (input && typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) out[key] = redact(redactValue(key, value), key);
    return out;
  }
  if (typeof input === 'string' && keyHint === undefined) return input;
  return input;
}

function journalDir() {
  const dir = process.env.E2E_JOURNAL_DIR;
  if (!dir) throw new Error('E2E_JOURNAL_DIR is not set - run the suite through `npm run test:e2e -- <selector>`.');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function file(name) {
  return path.join(journalDir(), name);
}

function appendJsonl(name, record) {
  fs.appendFileSync(file(name), `${JSON.stringify(redact(record))}\n`, 'utf8');
}

function readJsonl(name) {
  const target = file(name);
  if (!fs.existsSync(target)) return [];
  return fs
    .readFileSync(target, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function writeJson(name, value) {
  fs.writeFileSync(file(name), `${JSON.stringify(redact(value), null, 2)}\n`, 'utf8');
}

function readJson(name, fallback = null) {
  const target = file(name);
  if (!fs.existsSync(target)) return fallback;
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

function writeText(name, value) {
  fs.writeFileSync(file(name), value, 'utf8');
}

function readText(name, fallback = '') {
  const target = file(name);
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : fallback;
}

module.exports = { redact, appendJsonl, readJsonl, writeJson, readJson, writeText, readText, journalDir, file };
