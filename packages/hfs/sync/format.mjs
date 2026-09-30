// format.mjs - HFS_FORMAT (R19): Prettier is the only formatter, and every tracked file it formats is formatted.
// The check is `prettier --check` over the tracked files through the repository's OWN prettier (resolved from the repository,
// with the repository's prettier config and .prettierignore), so it judges what the repository's pre-commit and CI judge. A
// repository with no installed prettier is a refusal (HFS_FORMAT_TOOL_MISSING), never a pass. It is slow and is not part of `--fast`.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { SyncError } from './index.mjs';

export const FORMAT = 'HFS_FORMAT';
export const IGNORE_FILE = '.prettierignore';
/** Lockfiles are written by npm, not by people: they are never formatted. */
const LOCKFILES = new Set(['package-lock.json']);

/** The repository's own prettier, or a SyncError when it is not installed. */
export function loadPrettier(repoRoot) {
  const require = createRequire(path.join(repoRoot, 'package.json'));
  try {
    return require('prettier');
  } catch {
    throw new SyncError('HFS_FORMAT_TOOL_MISSING', `prettier is not installed under ${repoRoot}; install the version knowledge/hfs/canon-pins.yaml pins, so the format check judges what the repository's own gates judge`);
  }
}

/**
 * The HFS_FORMAT findings over the tracked `files` of `repoRoot`: one per file prettier would change, or cannot parse.
 * `prettier` is a seam for specs; the default is the repository's own.
 */
export async function formatFindings({ repoRoot, files, prettier = loadPrettier(repoRoot) }) {
  const ignorePath = path.join(repoRoot, IGNORE_FILE);
  const findings = [];
  for (const file of files.filter((f) => !LOCKFILES.has(path.posix.basename(f)))) {
    const absolute = path.join(repoRoot, file);
    let text;
    try { text = fs.readFileSync(absolute, 'utf8'); } catch { continue; }
    const info = await prettier.getFileInfo(absolute, { ignorePath: fs.existsSync(ignorePath) ? ignorePath : undefined, resolveConfig: true });
    if (info.ignored || !info.inferredParser) continue;
    const options = (await prettier.resolveConfig(absolute, { editorconfig: true, useCache: false })) ?? {};
    try {
      if (!(await prettier.check(text, { ...options, filepath: absolute }))) findings.push({ code: FORMAT, level: 'error', path: file, message: `${file} is not formatted by prettier; run \`npm run format\`` });
    } catch (error) {
      findings.push({ code: FORMAT, level: 'error', path: file, message: `${file} cannot be formatted: ${String(error?.message ?? error).split('\n')[0]}` });
    }
  }
  return findings;
}
