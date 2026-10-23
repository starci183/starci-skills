// tmpdir.mjs — a spec's temp dir that removes itself.
//
//   const dir = mkdtemp(t, 'starci-thing-');
//   const dir = mkdtemp(t, 'starci-thing-', () => handle.stop());        // stop children before the rm
//
// Every fixture a spec builds under the OS temp root must come down again, on pass and on failure (test temp
// hygiene: the suite leaves no new starci* dirs behind). mkdtemp registers the recursive removal on the test
// context, so a spec body only names the dir. `before` runs inside the same after-callback, ahead of the
// removal: a spec whose fixture holds live children (a supervisor, a spawned manager) stops them there instead
// of racing an rm registered before the kill hooks ever existed. The removal retries like the rest of the
// suite does - a killed child's handle can still hold a file on Windows for a beat.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function mkdtemp(t, prefix = 'starci-', before = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    try { await before?.(); } finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); }
  });
  return dir;
}
