import fs from 'node:fs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';

// Remove a file-reference delivery artifact. Transient artifacts take their
// private tmpdir with them; a card-declared directory is only emptied of the
// file itself. Best-effort — a leftover temp file never fails the caller.
export function cleanupDeliveryArtifact(artifact) {
  if (!artifact?.file) return { ok: true, removed: false };
  try { fs.rmSync(artifact.file, { force: true }); } catch { /* best-effort */ }
  if (artifact.transient && artifact.dir) {
    try { safeRemoveTree(artifact.dir); } catch { /* best-effort */ }
  }
  return { ok: true, removed: true };
}
