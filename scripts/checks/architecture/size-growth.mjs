import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * HFS check 6, file size growth (knowledge/hfs/slots.yaml ruleParams.<profile>.fileLines {soft, hardGrowth}):
 * a production source file over `soft` lines may not grow against the merge-base, and a file that is new at the base
 * must stay within `soft`. A file at or under `soft` passes, even when it grows, as long as it does not cross `soft`
 * (crossing is growth of an over-budget file: the base had fewer lines than soft). Files are compared to the base file
 * of the same path only, so a moved file is judged as new. The per-slot budgets (component 300, hook 200 ...) belong to
 * the lint layer and are not judged here.
 */
export const SIZE_GROWTH_RULE_IDS = ['HFS_SIZE_GROWTH'];

const MAX_BUFFER = 64 * 1024 * 1024;

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_BUFFER }).toString();
  } catch {
    return null;
  }
}

/** The commit the growth is measured against: the given commit-ish, else merge-base with upstream, origin/main, origin/master, else HEAD's first parent. */
function resolveBase(root, requested) {
  const commit = (rev) => { const out = git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]); return out ? out.trim() : null; };
  if (requested) return commit(requested);
  if (!commit('HEAD')) return null;
  for (const other of ['@{upstream}', 'origin/main', 'origin/master']) {
    if (!commit(other)) continue;
    const merged = git(root, ['merge-base', 'HEAD', other]);
    if (merged?.trim()) return merged.trim();
  }
  return commit('HEAD^');
}

export function countLines(text) {
  if (!text) return 0;
  const count = text.split('\n').length;
  return text.endsWith('\n') ? count - 1 : count;
}

export function checkSizeGrowth({ config, graph, base } = {}) {
  const root = config.root;
  const sha = resolveBase(root, base);
  if (!sha) return { violations: [], coverage: { status: 'unavailable', reason: 'no merge-base' } };
  const { soft, hardGrowth } = graph.resolver.ruleParams().fileLines;
  const violations = [];
  let files = 0;
  let overSoft = 0;
  let grown = 0;
  let newOverSoft = 0;
  for (const rel of [...graph.files.keys()].sort()) {
    let text;
    try { text = fs.readFileSync(graph.files.get(rel).abs, 'utf8'); } catch { continue; }
    files += 1;
    const lines = countLines(text);
    if (lines <= soft) continue;
    overSoft += 1;
    const baseText = git(root, ['cat-file', 'blob', `${sha}:${rel}`]);
    const baseLines = baseText === null ? null : countLines(baseText);
    if (baseLines === null) {
      newOverSoft += 1;
      if (hardGrowth) violations.push({ ruleId: 'HFS_SIZE_GROWTH', path: rel, line: 1, lines, baseLines: null, soft,
        message: `${rel} is a new file of ${lines} lines, over the ${soft}-line soft budget; split it into smaller files before adding it.` });
    } else if (lines > baseLines) {
      grown += 1;
      if (hardGrowth) violations.push({ ruleId: 'HFS_SIZE_GROWTH', path: rel, line: 1, lines, baseLines, soft,
        message: `${rel} has ${lines} lines, over the ${soft}-line soft budget, and grew from ${baseLines} lines at the base; a file over budget may only shrink, so split the new code into another file.` });
    }
  }
  return { violations, coverage: { status: 'checked', base: sha, files, overSoft, grown, newOverSoft } };
}
