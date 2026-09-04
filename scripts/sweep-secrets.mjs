// The one home of the secret-shaped patterns the tree refuses in anything an agent writes. A sealed
// value is resolved only where it is consumed (a form, a request body, a client); it never reaches a
// receipt, a capture name, a log an agent kept, or a transcript. Advice cannot hold that line — a
// diagnostic that prints a credential file is one tool call away — so the response gate sweeps every
// text file under a branch's response/ folder with these patterns before the branch can route, and
// uat.verify sweeps the flow folder with the same list. Patterns match value shapes, not the words
// that describe them: a receipt may say that a password was resolved by name.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const SECRET_PATTERNS = [
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: 'bearer', re: /\bBearer\s+[A-Za-z0-9._~+/-]{24,}=*/ },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: 'openai-key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { id: 'slack-token', re: /\bxox[abpr]-[A-Za-z0-9-]{20,}/ },
  { id: 'password-literal', re: /\bpassword["']?\s*[:=]\s*["'][^"'\n]{6,}["']/i },
  { id: 'client-secret', re: /\b(?:client[_-]?secret|api[_-]?key|secret[_-]?key|access[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i },
];
// The placeholder uat.verify's self-test injects for the shared UAT password, plus any inline
// assignment of one: the shared password reaches a form or a request body and nothing else.
export const PASSWORD_LEAK = /uat-shared-password|password\s*[:=]\s*\S/i;

// One text, any pattern: the operators' own refusals of a credential-shaped value use this and carry no
// copy of the list.
export const credentialShaped = (text) => PASSWORD_LEAK.test(String(text ?? '')) || SECRET_PATTERNS.some(({ re }) => re.test(String(text ?? '')));

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ico', '.mp4', '.webm']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name === 'node_modules' || entry.name === '.git') continue; yield* walk(full); }
    else if (!BINARY.has(path.extname(entry.name).toLowerCase()) && statSync(full).size <= 4 * 1024 * 1024) yield full;
  }
}

// Every text file under `dir`, checked line by line; a finding names the file, the line and the
// pattern id, never the matched value.
export function sweepSecrets(dir, { patterns = SECRET_PATTERNS, relativeTo = dir } = {}) {
  const findings = [];
  let exists = true;
  try { statSync(dir); } catch { exists = false; }
  if (!exists) return findings;
  for (const file of walk(dir)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { id, re } of patterns) if (re.test(line)) findings.push({ file: path.relative(relativeTo, file).split(path.sep).join('/'), line: i + 1, pattern: id });
    });
  }
  return findings;
}

export const secretErrors = (dir, opts) => sweepSecrets(dir, opts).map((f) => `${f.file}:${f.line}: carries a ${f.pattern}-shaped value; a sealed value is resolved only where it is consumed and never written into a receipt, an artifact or a log`);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node scripts/sweep-secrets.mjs <folder>\n'); process.exit(2); }
  const errors = secretErrors(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('no secret-shaped value found\n');
}
