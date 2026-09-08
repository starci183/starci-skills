// Nextra 3 resolves its page tree from a directory inside the Next app, so `pages/` cannot point at
// ../../docs. This step copies the documentation source into pages/ before dev and before build; the
// copy is disposable and gitignored, and docs/ stays the only place a page is edited.
//
// Skipped on the way in: README.md (it explains the folder to a contributor, it is not a page) and
// scripts/ (the generator itself). The Next app shell in shell/ is copied in afterwards, because
// Nextra requires a custom App component inside pages/ and pages/ is rebuilt every time.
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(site, '../../docs');
const target = path.join(site, 'pages');
const SKIP = new Set(['README.md', 'README.vi.md', 'scripts']);

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

let copied = 0;
for (const entry of await readdir(source)) {
  if (SKIP.has(entry)) continue;
  await cp(path.join(source, entry), path.join(target, entry), { recursive: true });
  copied += 1;
}

await cp(path.join(site, 'shell'), target, { recursive: true });

process.stdout.write(`docs site: synced ${copied} entries from docs/ into pages/, plus the app shell\n`);
