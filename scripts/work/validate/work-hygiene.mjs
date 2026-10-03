#!/usr/bin/env node
// work-hygiene.mjs — the parse, scoped-validate and secret checks a product repo's Work files owe before they are
// committed (the pre-commit hook scripts/guards/hook-install.mjs installs) and before an op settles (starci kernel settle).
//   starci work hygiene staged --repo <root> [--json]     the staged files of <root>, from the index
//   starci work hygiene files  --repo <root> [--json] <file>...   the named files, from disk
// Two failure classes slipped through on 2026-09-29: YAML the runtime loader cannot parse (a ": " inside a plain
// scalar) was committed to a product .starciwork, and literal usernames/passwords sat in accounts.yaml files with no
// check to flag them. Three checks, read-only, scoped to the files given (never the whole tree, never e2e):
//   1. parse     every .starciwork/**.yaml|yml parses with engine/yaml.mjs                    WORK_YAML_UNPARSEABLE
//   2. validate  scripts/work/validate/work-validate.mjs --strict over each record directory, its refusals judged only when
//                they name a file in the given set (scopeToOwned); the rest are someone else's debt   WORK_VALIDATE_REFUSED
//   3. secrets   text files under .starciwork/ and .starcistacks/ that are not *.enc: a secret-shaped path
//                (WORK_SECRET_FILE), a provider token or private key (WORK_SECRET_PATTERN), a literal in a
//                credential-shaped key (WORK_SECRET_LITERAL), a literal username in an accounts file
//                (WORK_ACCOUNT_LITERAL). A value that is a reference (`$X`, `secret:x`, `<x>`, `ref:x`) or names itself a
//                stand-in (fixture, example, changeme) is not a literal.
import fs from 'node:fs';
import path from 'node:path';
import { diff as gitDiff } from '../../api/git/diff.mjs';
import { show as gitShow } from '../../api/git/show.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { FORBIDDEN_FILES, SECRET_PATTERNS } from '../../lib/secret-patterns.mjs';
import { scopeToOwned, validateWork } from './work-validate.mjs';
import { isMain } from '../../lib/is-main.mjs';
import { withoutGitLocalEnv } from '../../lib/git.mjs';
import { samePath } from '../../lib/path-key.mjs';
import { readEnv } from '../../lib/env.mjs';

export const WORK_YAML_UNPARSEABLE = 'WORK_YAML_UNPARSEABLE';
export const WORK_VALIDATE_REFUSED = 'WORK_VALIDATE_REFUSED';
export const WORK_SECRET_FILE = 'WORK_SECRET_FILE';
export const WORK_SECRET_PATTERN = 'WORK_SECRET_PATTERN';
export const WORK_SECRET_LITERAL = 'WORK_SECRET_LITERAL';
export const WORK_ACCOUNT_LITERAL = 'WORK_ACCOUNT_LITERAL';
export const WORK_HYGIENE_CHANGE = 'work-hygiene-gate';

const slashed = (p) => String(p).replace(/\\/g, '/');
const WORK_PATH = /(^|\/)\.starciwork\//;
const STACK_PATH = /(^|\/)\.starcistacks\//;
const YAML_FILE = /\.ya?ml$/i;
const ENCRYPTED = /\.enc$/i;
const BINARY = /\.(?:png|jpe?g|gif|webp|avif|ico|bmp|mp4|webm|mov|mp3|wav|pdf|zip|gz|tgz|7z|woff2?|ttf|otf|eot|sqlite|db)$/i;
export const inWorkTree = (rel) => WORK_PATH.test(slashed(rel));
export const inSecretScope = (rel) => (WORK_PATH.test(slashed(rel)) || STACK_PATH.test(slashed(rel))) && !ENCRYPTED.test(rel);

// ---------------------------------------------------------------------------------------------- secret scan
const STANDIN = /^\.{2,}|fixture|stub|fake|dummy|placeholder|example|sample|changeme|redacted|mock|todo|tbd|xxx|n\/a|not[-_ ]?set|none|null|undefined|disposable|generated|your[-_ ]|\*{3,}/i;
const REFERENCE = /^(?:\$|<|\{\{|%|@|secret[:.]|secrets[:.]|ref[:.]|env[:.]|sops[:.]|file[:.]|vault[:.]|kms[:.]|\/run\/secrets\/|identity\.|\[redacted|ENC\[)/i;
const CODE_OR_STYLE = /^[-./@~]|[(){}\[\]<>`$]|\.\.\./;
const PROSE_OR_CODE = /\.(?:md|mdx|markdown|java|kt|tf|ts|tsx|js|mjs|cjs|py|go|sql|sh|ps1|cs|rb)$/i;
const PASSWORD_WORDS = new Set(['password', 'passwd', 'pwd', 'passphrase']);
const CREDENTIAL_WORDS = new Set(['secret', 'token', 'apikey', 'credential', 'credentials']);
const USER_KEYS = new Set(['username', 'user', 'userid', 'login', 'email']);

/** Words of a key: camelCase, snake_case and kebab-case split, lower-cased. */
const wordsOf = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
/** 'password' | 'credential' | null: what kind of credential a key names by its LAST word (passwordHash, tokenRef, secretName are not it). */
function credentialKind(key) {
  const words = wordsOf(key);
  const last = words[words.length - 1];
  if (!last) return null;
  if (PASSWORD_WORDS.has(last)) return 'password';
  if (CREDENTIAL_WORDS.has(last)) return 'credential';
  if (last === 'key' && words.length > 1 && ['api', 'private', 'secret', 'access', 'auth', 'signing', 'encryption'].includes(words[words.length - 2])) return 'credential';
  if (last === 'apikey' || last === 'privatekey') return 'credential';
  return null;
}
function entropy(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) { const p = n / text.length; bits -= p * Math.log2(p); }
  return bits;
}
const unquote = (raw) => {
  const v = String(raw).trim();
  const q = /^(["'])(.*)\1$/.exec(v);
  return q ? { value: q[2], quoted: true } : { value: v.replace(/\s+#.*$/, '').replace(/[,;]+$/, ''), quoted: false };
};
/** True when `value` is a literal credential for a key of `kind` (a reference, a stand-in and an empty value are not). */
export function isLiteralCredential(value, kind, { quoted = false } = {}) {
  const v = String(value).trim();
  if (!v || /^(?:~|null|true|false|\[\]|\{\}|\|[+-]?|>[+-]?)$/i.test(v)) return false;
  if (REFERENCE.test(v) || STANDIN.test(v)) return false;
  if (/^\d+(?:\.\d+)?$/.test(v) && kind !== 'password') return false; // a count or a budget
  if (CODE_OR_STYLE.test(v)) return false; // an expression, a path, a CSS variable, a flow mapping
  if (kind === 'password') return quoted || !/\s/.test(v);
  if (/\s/.test(v) || v.length < 16) return false;
  return entropy(v) >= 3.5 || (/[A-Za-z]/.test(v) && /\d/.test(v));
}
// `key: value`, `key=value`, `- key: value`, and every pair of an inline {a: b, c: d}.
const PAIR = /(?<![\w.-])(["']?)([A-Za-z_][\w-]*)\1\s*[:=]\s*("[^"\n]*"|'[^'\n]*'|[^\s,}\]#]+)/g;
const isAccountsFile = (rel, text) => /(^|\/)accounts\.ya?ml$/i.test(rel) || /schema:\s*work\/disposable-accounts@/.test(text);

/** The secret findings of one text file: [{code, file, line, detail}]. The value itself never appears in a finding. */
export function scanSecrets(rel, text) {
  const file = slashed(rel);
  if (ENCRYPTED.test(file)) return []; // encrypted custody is where a secret belongs
  const findings = [];
  const forbidden = FORBIDDEN_FILES.find((rule) => rule.test(file));
  if (forbidden) findings.push({ code: WORK_SECRET_FILE, file, line: 0, detail: `the path is a secret by being one (${forbidden.name})` });
  if (typeof text !== 'string') return findings;
  const pushOnce = (finding) => { if (!findings.some((f) => f.code === finding.code && f.line === finding.line && f.detail === finding.detail)) findings.push(finding); };
  const accounts = isAccountsFile(file, text);
  const proseOrCode = PROSE_OR_CODE.test(file);
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const at = index + 1;
    for (const rule of SECRET_PATTERNS) {
      if (rule.skipFile?.test(file)) continue;
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.placeholder && rule.placeholder.test(m[1] ?? line)) continue;
      pushOnce({ code: WORK_SECRET_PATTERN, file, line: at, detail: `${rule.name} in the text` });
    }
    if (proseOrCode) return; // prose explains "password: ..." fields and code assigns expressions; only the provider shapes above apply
    for (const m of line.matchAll(PAIR)) {
      const key = m[2];
      const { value, quoted } = unquote(m[3]);
      const kind = credentialKind(key);
      if (kind && isLiteralCredential(value, kind, { quoted })) pushOnce({ code: WORK_SECRET_LITERAL, file, line: at, detail: `key \`${key}\` holds a literal value; keep the value in encrypted custody (.enc) and reference it` });
      else if (accounts && USER_KEYS.has(key.toLowerCase()) && value && !REFERENCE.test(value) && !STANDIN.test(value) && !/^(?:~|null|true|false)$/i.test(value)) {
        pushOnce({ code: WORK_ACCOUNT_LITERAL, file, line: at, detail: `accounts record key \`${key}\` holds a literal login; name the account by its identity reference` });
      }
    }
  });
  return findings;
}

// ------------------------------------------------------------------------------------------------- the check
const relTo = (root, abs) => slashed(path.relative(root, abs));
const gitOut = (call, root, args, env) => call(args, { dir: root, maxBuffer: 64 * 1024 * 1024, timeout: 30_000, ...(env ? { env } : {}) });
const stagedGitEnv = (root) => {
  const env = withoutGitLocalEnv(process.env);
  const index = readEnv('GIT_INDEX_FILE');
  if (index && samePath(root, path.resolve(process.cwd()))) env.GIT_INDEX_FILE = path.resolve(process.cwd(), index);
  return env;
};

/**
 * checkWorkFiles({repo, files, read, strict}) -> {ok, findings[], files: n, checked: {parse, validate, secrets}}
 * `files` are repo-relative or absolute paths (deleted ones are skipped by the caller); `read(rel)` returns a file's text
 * (default: the working tree; the hook passes the index blob). Only .starciwork/ and .starcistacks/ files count.
 */
export function checkWorkFiles({ repo, files, read = null, strict = true } = {}) {
  const root = path.resolve(repo ?? '.');
  const rels = [...new Set((files ?? []).map((f) => (path.isAbsolute(f) ? relTo(root, f) : slashed(f))).filter((f) => f && !f.startsWith('..') && inSecretScope(f)))].sort();
  const reader = read ?? ((rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch { return null; } });
  const findings = [];
  const checked = { parse: 0, validate: 0, secrets: 0 };
  const parsed = [];
  for (const rel of rels.filter((f) => inWorkTree(f) && YAML_FILE.test(f))) {
    const text = reader(rel);
    if (text == null) continue;
    checked.parse += 1;
    try { parseYaml(text); parsed.push(rel); }
    catch (error) { findings.push({ code: WORK_YAML_UNPARSEABLE, file: rel, line: Number(/line (\d+)/i.exec(String(error?.message))?.[1] ?? 0), detail: String(error?.message ?? error).split('\n')[0].slice(0, 240) }); }
  }
  // Validate: each directory that holds a parsed file, once; a refusal counts only when it names one of the given files.
  const dirs = [...new Set(parsed.map((rel) => path.dirname(path.join(root, rel))))].filter((d) => fs.existsSync(d));
  const owned = parsed.map((rel) => path.join(root, rel));
  for (const dir of dirs) {
    let report;
    try { report = scopeToOwned(validateWork(dir, { strict }), owned); }
    catch (error) { findings.push({ code: WORK_VALIDATE_REFUSED, file: relTo(root, dir), line: 0, detail: `validation crashed closed: ${String(error?.message ?? error).slice(0, 200)}` }); continue; }
    checked.validate += 1;
    for (const refusal of report.refused) findings.push({ code: WORK_VALIDATE_REFUSED, file: relTo(root, dir), line: 0, detail: String(refusal).replace(root, '').replace(/\\/g, '/').slice(0, 300) });
  }
  for (const rel of rels) {
    if (BINARY.test(rel)) { for (const f of scanSecrets(rel, null)) findings.push(f); continue; }
    const text = reader(rel);
    if (text == null) continue;
    checked.secrets += 1;
    findings.push(...scanSecrets(rel, text));
  }
  return { ok: findings.length === 0, findings, files: rels.length, checked };
}

/** The repository root a path under .starciwork/ or .starcistacks/ belongs to: what precedes that folder. */
const rootOfAbs = (abs) => { const m = /^(.*?)[\\/]\.(?:starciwork|starcistacks)[\\/]/.exec(abs); return m ? m[1] : null; };
/**
 * checkWorkFilesAbs(files) - the same check over absolute paths that may belong to several repositories (a settle names
 * the files of a BE and an FE checkout): each repository's files are judged against its own root, the findings joined.
 */
export function checkWorkFilesAbs(files, options = {}) {
  const groups = new Map();
  for (const abs of files ?? []) {
    const root = path.isAbsolute(abs) ? rootOfAbs(abs) : null;
    if (root) (groups.get(path.resolve(root)) ?? groups.set(path.resolve(root), []).get(path.resolve(root))).push(abs);
  }
  const merged = { ok: true, findings: [], files: 0, checked: { parse: 0, validate: 0, secrets: 0 } };
  for (const [repo, list] of groups) {
    const r = checkWorkFiles({ repo, files: list, ...options });
    merged.findings.push(...r.findings.map((f) => ({ ...f, file: groups.size > 1 ? `${slashed(repo)}/${f.file}` : f.file })));
    merged.files += r.files;
    for (const k of Object.keys(merged.checked)) merged.checked[k] += r.checked[k];
  }
  merged.ok = merged.findings.length === 0;
  return merged;
}

/** The staged (added, copied, modified, renamed) files of `repo`, read from the index. */
export function stagedFiles(repo) {
  const root = path.resolve(repo);
  const out = gitOut(gitDiff, root, ['--cached', '--name-only', '--diff-filter=ACMR', '-z'], stagedGitEnv(root));
  if (out.status !== 0) throw new Error(`git diff --cached failed: ${(out.stderr || '').trim().slice(0, 200)}`);
  return out.stdout.split('\0').filter(Boolean).map(slashed);
}
function stagedCheck(repo, options = {}) {
  const root = path.resolve(repo);
  const files = stagedFiles(root).filter(inSecretScope);
  const env = stagedGitEnv(root);
  const read = (rel) => { const r = gitOut(gitShow, root, [`:${rel}`], env); return r.status === 0 ? r.stdout : null; };
  return checkWorkFiles({ repo: root, files, read, ...options });
}

/** The files a committed range changed (repo-relative), for settle: base..head, added/copied/modified/renamed. */
export function rangeFiles(repo, base, head) {
  if (!base || !head) return [];
  const out = gitOut(gitDiff, path.resolve(repo), ['--name-only', '--diff-filter=ACMR', '-z', `${base}..${head}`]);
  return out.status === 0 ? out.stdout.split('\0').filter(Boolean).map(slashed) : [];
}

export function formatFindings(result, { limit = 30 } = {}) {
  const lines = result.findings.slice(0, limit).map((f) => `  ${f.code} ${f.file}${f.line ? `:${f.line}` : ''} - ${f.detail}`);
  if (result.findings.length > limit) lines.push(`  ... ${result.findings.length - limit} more`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const repo = flag('--repo') ?? process.cwd();
  const json = argv.includes('--json');
  let result;
  try {
    if (mode === 'staged') result = stagedCheck(repo);
    else if (mode === 'files') result = checkWorkFiles({ repo, files: argv.slice(1).filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--repo') });
    else { process.stderr.write('Usage: work-hygiene.mjs staged|files --repo <root> [--json] [<file>...]\n'); process.exit(2); }
  } catch (error) { process.stderr.write(`work-hygiene: ${error.message}\n`); process.exit(2); }
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (!result.ok) process.stderr.write(`starci work hygiene: refused - ${result.findings.length} finding(s) in the staged Work files (${fileURLToPath(import.meta.url).split(/[\\/]/).slice(-3).join('/')}); fix them and commit again\n${formatFindings(result)}\n`);
  process.exit(result.ok ? 0 : 1);
}
