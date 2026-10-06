// release-notes.mjs - RELEASE_NOTES (knowledge/hfs/rules.yaml, gate runtime): a release tag `v<version>` on HEAD has its CHANGELOG.md section
// `## [<version>]` with no TODO, PENDING or TBD left in it and no `in preparation` mark. The tag message and the GitHub Release are that section
// (docs/git-governance.md), so a tag cut over an unfinished section would publish a half-written release. Only the tags that point at HEAD are
// judged: the release being cut. Pure apart from ctx.read and the git read (ctx.tagsAtHead overrides it).
import { tag } from '../../api/git/tag.mjs';

export const CODE = 'RELEASE_NOTES';
const RELEASE_TAG = /^v\d[\w.+-]*$/;
const UNFINISHED = /\b(?:TODO|PENDING|TBD)\b|in preparation/i;

/** The CHANGELOG section of `version`: {found, body}. Pure. */
export function changelogSection(changelog, version) {
  const lines = String(changelog ?? '').split(/\r?\n/);
  const start = lines.findIndex((line) => { const m = /^## \[([^\]]+)\]/.exec(line); return m && m[1] === version; });
  if (start < 0) return { found: false, body: '' };
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## ['));
  return { found: true, body: lines.slice(start, end < 0 ? undefined : end).join('\n') };
}

/** The RELEASE_NOTES findings of the release tags `tags` against `changelog` text. Pure. */
export function releaseNotesFindings({ tags, changelog, file = 'CHANGELOG.md' }) {
  const found = [];
  for (const name of tags.filter((t) => RELEASE_TAG.test(t))) {
    const section = changelogSection(changelog, name.slice(1));
    if (!section.found) { found.push({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: the release tag ${name} has no \`## [${name.slice(1)}]\` section: write the release notes before the tag` }); continue; }
    const unfinished = new RegExp(UNFINISHED.source, 'gi');
    const marks = [...new Set([...section.body.matchAll(unfinished)].map(([mark]) => mark))];
    if (marks.length) {
      const listedMarks = marks.map((m) => `\`${m}\``).join(', ');
      found.push({ code: CODE, level: 'error', path: file, message: `${CODE} ${file}: the section of ${name} still holds ${listedMarks}: finish it before the tag` });
    }
  }
  return found;
}

/** RELEASE_NOTES over the checkout (ctx of scripts/hfs/runtime-check.mjs): the release tags at HEAD against the CHANGELOG at HEAD. */
export function releaseNotesRepoFindings(ctx) {
  let tags = ctx.tagsAtHead;
  if (!tags) {
    try { const r = tag(['--points-at', 'HEAD'], { dir: ctx.repoRoot }); tags = r.status === 0 ? String(r.stdout).split(/\r?\n/).map((t) => t.trim()).filter(Boolean) : []; } catch { tags = []; }
  }
  const changelog = ctx.read('CHANGELOG.md');
  return tags.some((t) => RELEASE_TAG.test(t)) ? releaseNotesFindings({ tags, changelog }) : [];
}
