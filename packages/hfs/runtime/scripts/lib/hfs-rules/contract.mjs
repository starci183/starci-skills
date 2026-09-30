// contract.mjs - HFS_CONTRACT_SNAPSHOT_DRIFT (R23): the contract is committed and the front-end copy equals the back end's.
//   back end   a repository with a GraphQL transport commits `contracts/<app>/schema.graphql` for each api app
//   front end  every `apps/<app>/src/modules/api/contract/<be-app>.{graphql,json}` is hash-equal to the sibling back end's
//              `contracts/<be-app>/schema.graphql` (openapi.json for .json); hfs.json `stacks` names the sibling
//              repository, and a sibling that is not checked out is reported (info), not compared
// That the committed snapshot equals what the app emits is `npm run contract:emit` in CI; it needs the app's dependencies and is not read here.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { found } from './read.mjs';

export const CONTRACT_SNAPSHOT_DRIFT = 'HFS_CONTRACT_SNAPSHOT_DRIFT';
export const GRAPHQL_TRANSPORT_SLOT = 'be.transport.graphql';
const COPY = /^apps\/([^/]+)\/src\/modules\/api\/contract\/([^/]+)\.(graphql|json)$/;
const SNAPSHOT_OF = { graphql: 'schema.graphql', json: 'openapi.json' };

/** sha256 of a file's text with line endings folded, or null when it cannot be read. */
export function contractHash(file) {
  try { return createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex'); } catch { return null; }
}

/** The findings of R23 for the repository at `repoRoot`. `stacks` is hfs.json's sibling back-end path (front end only). */
export function contractFindings({ repoRoot, files, repo, resolver, stacks }) {
  const findings = [];
  if (repo.profile === 'be') {
    const serves = files.some((file) => resolver.classifyPath(file).slot === GRAPHQL_TRANSPORT_SLOT);
    if (!serves) return findings;
    const tracked = new Set(files);
    for (const app of repo.apps.filter((a) => a.kind === 'api')) {
      const snapshot = `contracts/${app.name}/${SNAPSHOT_OF.graphql}`;
      if (!tracked.has(snapshot)) findings.push(found(CONTRACT_SNAPSHOT_DRIFT, snapshot, `${app.name} serves GraphQL but ${snapshot} is not committed; declare be.contract.graphql in hfs.json optionalSlots, run \`npm run contract:emit\` and commit the snapshot`, { app: app.name }));
    }
    return findings;
  }
  for (const file of files) {
    const match = COPY.exec(file);
    if (!match) continue;
    const [, app, beApp, ext] = match;
    if (!stacks) {
      findings.push(found(CONTRACT_SNAPSHOT_DRIFT, file, `${file} is a contract copy but hfs.json names no sibling back end (stacks), so it cannot be compared with the back end's snapshot`, { app }));
      continue;
    }
    const sibling = path.resolve(repoRoot, stacks);
    if (!fs.existsSync(sibling)) {
      findings.push(found(CONTRACT_SNAPSHOT_DRIFT, file, `${file} was not compared: the sibling back end ${stacks} is not checked out here`, { app, level: 'info' }));
      continue;
    }
    const snapshot = `contracts/${beApp}/${SNAPSHOT_OF[ext]}`;
    const theirs = contractHash(path.join(sibling, snapshot));
    if (theirs === null) {
      findings.push(found(CONTRACT_SNAPSHOT_DRIFT, file, `${stacks}/${snapshot} does not exist, so ${file} copies nothing; the back end commits its contract first`, { app, snapshot }));
      continue;
    }
    const ours = contractHash(path.join(repoRoot, file));
    if (ours !== theirs) findings.push(found(CONTRACT_SNAPSHOT_DRIFT, file, `${file} (${String(ours).slice(0, 12)}) differs from ${stacks}/${snapshot} (${theirs.slice(0, 12)}); run \`npm run contract:pull\``, { app, snapshot }));
  }
  return findings;
}
