// Add app deployment conformance to the delivery/quality service gate without changing legacy runtime custody rules.
import fs from 'node:fs';
import path from 'node:path';
import { walkFiles } from '../lib/walk.mjs';
import { readJson } from '../hfs/rules/read.mjs';
import { stacksFindings } from '../hfs/rules/stacks.mjs';
import { stacksRuntimeFindings } from '../hfs/rules/stacks-runtime.mjs';
import { findStackDeclaration } from '../lib/stack-declaration.mjs';
import { loadSlotManifest, openHfs } from '../hfs/slots.mjs';

/** Source paths admitted to stack and scheduling checks; never descend through symlinks. */
function safeSourceDirectory(repoRoot, relative) {
  const root = path.resolve(repoRoot);
  let cursor = path.resolve(root, relative);
  while (cursor !== root) {
    try { if (fs.lstatSync(cursor).isSymbolicLink()) return false; } catch { return false; }
    cursor = path.dirname(cursor);
  }
  return true;
}

export function applicationStackFiles(repoRoot) {
  return ['.starcistacks', '.github/workflows', 'deploy', 'scripts'].flatMap(relative => {
    if (!safeSourceDirectory(repoRoot, relative)) return [];
    return walkFiles(path.join(repoRoot, relative), { ignoreReadErrors: true, exclude: (_name, _file, entry) => entry.isSymbolicLink() })
      .map(file => path.relative(repoRoot, file).replaceAll('\\', '/'));
  });
}

export const appEdition = repoRoot => readJson(repoRoot, 'hfs.json')?.edition ?? 'full';

/** An HFS app uses its edition's slot shape; other repository declarations still receive Swarm runtime checks. */
export function applicationStackFindings(repoRoot) {
  const files = applicationStackFiles(repoRoot), declaration = readJson(repoRoot, 'hfs.json');
  if (declaration?.kind === 'app') {
    try {
      const resolver = openHfs({ declaration, manifest: loadSlotManifest() });
      const findings = stacksFindings({ repoRoot, files, resolver }), manifestFile = '.starcistacks/application-stacks.yaml';
      if (resolver.slot('app.starcistacks')?.requires?.includes('application-stacks.yaml') && !files.includes(manifestFile))
        return [{ code: 'HFS_STACKS_SHAPE', level: 'error', path: manifestFile, message: `${manifestFile}: the app stacks slot requires this declaration` }, ...findings];
      return findings;
    } catch (error) {
      return [{ code: 'HFS_STACKS_SHAPE', level: 'error', path: 'hfs.json', message: `hfs.json: cannot resolve the app stacks shape: ${error.message}` }];
    }
  }
  const doc = findStackDeclaration(repoRoot).doc;
  return doc ? stacksRuntimeFindings({ repoRoot, files, doc }) : [];
}

/** Lite may retain value-free development custody metadata without declaring a self-hosted development stack. */
export function liteCustodyDirectory(directory) {
  let entries;
  try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return false; }
  return entries.length > 0 && entries.every(entry => {
    if (entry.isSymbolicLink()) return false;
    if (entry.isFile()) return entry.name === 'environment.json';
    if (!entry.isDirectory() || entry.name !== 'secrets') return false;
    return fs.readdirSync(path.join(directory, entry.name), { withFileTypes: true })
      .every(secret => secret.isFile() && !secret.isSymbolicLink() && (secret.name === '.gitkeep' || /^[a-z0-9-]+\.enc$/.test(secret.name)));
  });
}
