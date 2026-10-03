// starci app new image - the Dockerfile of every declared app that has none, written from the image canon
// (templates/<side>/image/<kind>, the same render starci app scaffold uses). It never overwrites a file.
import fs from 'node:fs';
import path from 'node:path';
import { imageFiles, loadHfs, validateHfs } from '../sync/index.mjs';

/** Writes the missing Dockerfiles of the app at `repoRoot` (the folder of hfs.json); the app-relative paths written. */
export function newImages({ repoRoot }) {
  const files = imageFiles(validateHfs(loadHfs(repoRoot)));
  const written = [];
  for (const file of files) {
    const target = path.join(repoRoot, ...file.path.split('/'));
    if (fs.existsSync(target)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
    written.push(file.path);
  }
  return written;
}
