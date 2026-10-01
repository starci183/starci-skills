// rmdir-link.mjs — the link-safe removal primitive: `cmd /d /c rmdir <link>` (no /s) removes a Windows junction or
// directory symlink as a link and never touches its target. scripts/api/fs/safe-remove.mjs removeLink is its one caller and
// checks afterwards that the link is gone (unlinkOnly); this file only issues the call.

import { spawnSync } from 'node:child_process';

/** Issue `cmd /d /c rmdir <p>` on Windows; elsewhere nothing (a POSIX link is unlinked by the caller). {status, error}. */
export function rmdirLink(p, { platform = process.platform } = {}) {
  if (platform !== 'win32') return { status: null, error: null };
  const r = spawnSync('cmd', ['/d', '/c', 'rmdir', p], { windowsHide: true, encoding: 'utf8' });
  return { status: r.status, error: r.error?.message ?? null };
}
