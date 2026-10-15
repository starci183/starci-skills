// Identify runtime-owned example apps; an unrelated directory named examples grants no fixture behavior.
import fs from 'node:fs';
import path from 'node:path';

export function isRuntimeExampleApp(repoRoot) {
  if (path.basename(path.dirname(repoRoot)) !== 'examples') return false;
  try {
    const runtime = JSON.parse(fs.readFileSync(path.resolve(repoRoot, '..', '..', 'hfs.json'), 'utf8'));
    return runtime.kind === 'runtime';
  } catch {
    return false;
  }
}
