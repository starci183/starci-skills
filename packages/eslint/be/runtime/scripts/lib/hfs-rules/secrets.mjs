// secrets.mjs - HFS_PLAINTEXT_SECRET (R06): secrets exist only as `.starcistacks/<env>/secrets/<slug>.enc` sops envelopes.
// It judges the tracked tree with the one list of secret shapes the push scan refuses (scripts/lib/secret-patterns.mjs):
//   - a tracked file that is a secret by being (an env file, a key file, a credentials file, a plaintext member of a
//     secrets directory), and every path a forbidden `external` slot names HFS_PLAINTEXT_SECRET for (the slot manifest);
//   - a tracked `.enc` that is not a sops envelope (an encrypted-looking file that holds plaintext);
//   - a line of any other tracked text file that matches a secret pattern.
// A finding names the file, the line and the pattern, never the value.
import { FORBIDDEN_FILES, secretHits } from '../secret-patterns.mjs';
import { isSopsEnvelope } from '../test-secrets.mjs';
import { found, readText } from './read.mjs';

export const PLAINTEXT_SECRET = 'HFS_PLAINTEXT_SECRET';
/** Files whose lines are not secrets: a lockfile carries integrity hashes, never a credential. */
const NOT_SCANNED = /(^|\/)package-lock\.json$/;

/** True when the slot `id` of the manifest reports HFS_PLAINTEXT_SECRET for the paths it forbids. */
export const slotOwnsSecrets = (slot) => slot?.rules?.includes(PLAINTEXT_SECRET) === true;

/**
 * The findings of R06 for one tracked file that no forbidden slot claims: a secret by being (an env file, a key file), an `.enc` that is
 * no sops envelope, or a line that matches a secret pattern. `text` is the file's text, or null when it cannot be read (binary, too
 * large, absent). The whole-tree check reads the work tree and the commit hook (`hfs work-hygiene`) reads the staged blob: one judgement.
 */
export function secretFileFindings({ file, text }) {
  const being = FORBIDDEN_FILES.find((rule) => rule.test(file));
  if (being) return [found(PLAINTEXT_SECRET, file, `${file} is a plaintext secret by being (${being.name}); a secret is committed only as a sops envelope at .starcistacks/<env>/secrets/<slug>.enc`, { pattern: being.name })];
  if (text === null || text === undefined || NOT_SCANNED.test(file)) return [];
  if (file.endsWith('.enc')) return isSopsEnvelope(text) ? [] : [found(PLAINTEXT_SECRET, file, `${file} is named like a sealed secret but is not a sops envelope; encrypt the value with sops and commit only the envelope`, { pattern: 'sops-not-envelope' })];
  const findings = [];
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of secretHits(file, lines[index])) {
      if (seen.has(pattern)) continue;
      seen.add(pattern);
      findings.push(found(PLAINTEXT_SECRET, file, `${file}:${index + 1} holds a plaintext secret (${pattern}); seal it with sops at .starcistacks/<env>/secrets/<slug>.enc and read it by *_FILE`, { line: index + 1, pattern }));
    }
  }
  return findings;
}

/** The findings of R06 over `files` (tracked paths) of `repoRoot`; `resolver` names the slots. */
export function secretFindings({ repoRoot, files, resolver }) {
  const findings = [];
  for (const file of files) {
    const slot = resolver.classifyPath(file);
    if (slot.status === 'forbidden' && slotOwnsSecrets(resolver.slot(slot.slot))) {
      findings.push(found(PLAINTEXT_SECRET, file, `${file} is a plaintext secret file tracked in ${slot.slot}${slot.goesTo ? `; it belongs at ${slot.goesTo}` : ''}`, { slot: slot.slot, goesTo: slot.goesTo }));
      continue;
    }
    findings.push(...secretFileFindings({ file, text: readText(repoRoot, file) }));
  }
  return findings;
}
