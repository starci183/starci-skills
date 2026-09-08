import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export function normalizeResource(resource) {
  let value = String(resource).trim().replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[A-Za-z]:\//.test(value) || value.startsWith('/')) {
    let resolved = path.resolve(value);
    const suffix = [];
    let probe = resolved;
    while (!existsSync(probe) && path.dirname(probe) !== probe) { suffix.unshift(path.basename(probe)); probe = path.dirname(probe); }
    if (existsSync(probe)) {
      try { resolved = path.join(realpathSync.native(probe), ...suffix); } catch {}
    }
    value = resolved.replace(/\\/g, '/').replace(/^\/\/\?\//, '').replace(/\/+$/, '');
  }
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

export function resourcesOverlap(left, right) {
  const a = normalizeResource(left);
  const b = normalizeResource(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function effectiveExclusiveResources(request) {
  const resources = [...(request.environment?.exclusive ?? [])];
  if ((request.environment?.writes ?? []).length && request.environment?.workspace?.worktree) resources.push(request.environment.workspace.worktree);
  for (const write of request.environment?.writes ?? []) if (path.isAbsolute(write)) resources.push(write);
  return [...new Set(resources.map(normalizeResource))].sort();
}
