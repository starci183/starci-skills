// secrets.mjs - HFS_PLAINTEXT_SECRET (R06): secrets exist only as `.starcistacks/<env>/secrets/<slug>.enc` sops envelopes.
// It judges the tracked tree with the one list of secret shapes the push scan refuses (scripts/lib/secret-patterns.mjs):
//   - a tracked file that is a secret by being (an env file, a key file, a credentials file, a plaintext member of a
//     secrets directory), and every path a forbidden `external` slot names HFS_PLAINTEXT_SECRET for (the slot manifest);
//   - a tracked `.enc` that is not a sops envelope (an encrypted-looking file that holds plaintext);
//   - a line of any other tracked text file that matches a secret pattern.
// A finding names the file, the line and the pattern, never the value.
import fs from 'node:fs';
import path from 'node:path';
import { FORBIDDEN_FILES, secretHitsInFile } from '../../lib/secret-patterns.mjs';
import { isSopsEnvelope } from '../../lib/sops-envelope.mjs';
import { found, readText } from './read.mjs';

const PLAINTEXT_SECRET = 'HFS_PLAINTEXT_SECRET';
/** Files whose lines are not secrets: a lockfile carries integrity hashes, never a credential. */
const NOT_SCANNED = /(^|\/)package-lock\.json$/;

/** True when the slot `id` of the manifest reports HFS_PLAINTEXT_SECRET for the paths it forbids. */
export const slotOwnsSecrets = (slot) => slot?.rules?.includes(PLAINTEXT_SECRET) === true;

/** A legacy lite root secrets.env is reported even when ignored; its presence is enough, so no value is read. */
export function untrackedSecretFindings({ repoRoot, files, repo }) {
  if (repo.profile !== 'app' || repo.edition !== 'lite' || files.includes('secrets.env')) return [];
  try {
    if (!fs.statSync(path.join(repoRoot, 'secrets.env')).isFile()) return [];
  } catch {
    return [];
  }
  return [found(PLAINTEXT_SECRET, 'secrets.env', 'secrets.env is an untracked plaintext secret at the lite app root; seal it with starci app secret set into .starcistacks/<env>/secrets/<slug>.enc and remove the plaintext file; read materialized values by *_FILE', { level: 'warning', pattern: 'untracked-secrets-env' })];
}

/**
 * The findings of R06 for one tracked file that no forbidden slot claims: a secret by being (an env file, a key file), an `.enc` that is
 * no sops envelope, or a line that matches a secret pattern. `text` is the file's text, or null when it cannot be read (binary, too
 * large, absent). The whole-tree check reads the work tree and the commit hook (`starci app hygiene`) reads the staged blob: one judgement.
 */
export function secretFileFindings({ file, text, manifestText }) {
  const being = FORBIDDEN_FILES.find((rule) => rule.test(file));
  if (being) return [found(PLAINTEXT_SECRET, file, `${file} is a plaintext secret by being (${being.name}); a secret is committed only as a sops envelope at .starcistacks/<env>/secrets/<slug>.enc`, { pattern: being.name })];
  if (text === null || text === undefined || NOT_SCANNED.test(file)) return [];
  if (file.endsWith('.enc')) return isSopsEnvelope(text) ? [] : [found(PLAINTEXT_SECRET, file, `${file} is named like a sealed secret but is not a sops envelope; encrypt the value with sops and commit only the envelope`, { pattern: 'sops-not-envelope' })];
  const findings = [];
  const seen = new Set();
  for (const { line, pattern } of secretHitsInFile(file, text, { manifestText })) {
    if (seen.has(pattern)) continue;
    seen.add(pattern);
    findings.push(found(PLAINTEXT_SECRET, file, `${file}:${line} holds a plaintext secret (${pattern}); seal it with sops at .starcistacks/<env>/secrets/<slug>.enc and read it by *_FILE`, { line, pattern }));
  }
  return findings;
}

/** The findings of R06 over `files` (tracked paths) of `repoRoot`; `resolver` names the slots. */
export function secretFindings({ repoRoot, files, resolver }) {
  const findings = [];
  for (const file of files) {
    const slot = resolver.classifyPath(file);
    if (slot.status === 'forbidden' && slotOwnsSecrets(resolver.slot(slot.slot))) {
      const destination = slot.goesTo ? `; it belongs at ${slot.goesTo}` : '';
      findings.push(found(PLAINTEXT_SECRET, file, `${file} is a plaintext secret file tracked in ${slot.slot}${destination}`, { slot: slot.slot, goesTo: slot.goesTo }));
      continue;
    }
    const manifestText = /(?:^|\/)README\.md$/.test(file) ? readText(repoRoot, path.posix.join(path.posix.dirname(file), '.starcistacks/application-stacks.yaml')) : undefined;
    findings.push(...secretFileFindings({ file, text: readText(repoRoot, file), manifestText }));
  }
  return findings;
}

// The age identity stays on the host: `.claude/secret.env` (SOPS_AGE_KEY) or the sops config dir's `keys.txt`,
// both host-local files. A tracked `secret.env`, `keys.txt` or `*.agekey` is the identity committed.
const AGE_KEY_FILE = /^\.claude\/secret\.env$|(?:^|\/)keys\.txt$|\.agekey$/i;
export function ageKeyCustodyFindings({ files, inScope }) {
  const findings = [];
  for (const file of files.filter((f) => !inScope || inScope(f))) {
    if (!AGE_KEY_FILE.test(file)) continue;
    findings.push(found('HFS_AGE_KEY_CUSTODY', file,
      `${file} is a tracked sops/age identity file; the age key lives only in the host-local .claude/secret.env or the sops keys.txt - never commit the identity`));
  }
  return findings;
}
