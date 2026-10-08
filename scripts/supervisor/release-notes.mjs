import fs from 'node:fs';
import path from 'node:path';
import { changelogSection, releaseNotesFindings } from '../hfs/runtime-rules/release-notes.mjs';

const SCHEMA = 'starci/release-notes@1';
const USAGE = 'starci release notes --tag <v*> [--repo <dir>] [--out <file>]';
const RELEASE_TAG = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** True when the version carries a pre-release part (`-alpha.N`, `-beta.N`, `-rc.N`). */
export function isPrerelease(version) {
  return /^\d+\.\d+\.\d+-/.test(version);
}

/** The notes of release `tag`: the CHANGELOG section the annotated tag message is made of, one owner for both. */
export function releaseNotes(ctx, deps = {}) {
  const args = ctx?.args ?? {};
  const result = (code, text, extra = {}) => ({ code, text, data: { schema: SCHEMA, ok: code === 0, tag: args.tag ?? null, ...extra } });
  if ((ctx?.positionals ?? []).length || !args.tag) return result(2, `usage: ${USAGE}`);
  if (!RELEASE_TAG.test(args.tag)) return result(2, `${args.tag} is not a release tag: v<version>`);
  const repo = path.resolve(args.repo ?? ctx?.cwd ?? process.cwd());
  const read = deps.readChangelog ?? ((dir) => fs.readFileSync(path.join(dir, 'CHANGELOG.md'), 'utf8'));
  let changelog;
  try { changelog = read(repo); } catch (error) { return result(1, `starci release notes: ${String(error?.message ?? error)}`); }
  const findings = releaseNotesFindings({ tags: [args.tag], changelog });
  if (findings.length) return result(1, findings.map((finding) => finding.message).join('\n'), { findings });
  const version = args.tag.slice(1);
  const { body } = changelogSection(changelog, version);
  const prerelease = isPrerelease(version);
  if (!args.out) return result(0, body, { version, prerelease });
  fs.writeFileSync(path.resolve(args.out), `${body}\n`);
  return result(0, `release notes of ${args.tag} written to ${args.out} (${prerelease ? 'pre-release' : 'release'})`, { version, prerelease, out: args.out });
}
