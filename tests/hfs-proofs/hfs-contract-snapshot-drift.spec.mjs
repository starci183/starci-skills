// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@lite
// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { contractFindings } from '../../scripts/hfs/rules/contract.mjs';

const CODE = 'HFS_CONTRACT_SNAPSHOT_DRIFT';
const SNAPSHOT = 'contracts/api/schema.graphql';
const TRANSPORT = 'src/features/api/orders/transport/graphql/orders-graphql.module.ts';

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: a GraphQL app must track its schema snapshot`, (t) => {
    const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-contract-'));
    t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));
    const repoRoot = path.join(appRoot, 'be');
    const files = [];
    const write = (file, text) => {
      fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
      fs.writeFileSync(path.join(repoRoot, file), text);
      files.push(file);
    };
    fs.writeFileSync(path.join(appRoot, 'hfs.json'), JSON.stringify({ hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }], optionalSlots: ['be.contract.graphql'] }, fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] } } }));
    write('apps/api/src/app.module.ts', "import { GraphqlModule } from '@modules/platform/graphql';\nexport const modules = [GraphqlModule];\n");
    write(TRANSPORT, 'export class OrdersGraphqlModule {}\n');
    const resolver = openHfs({ repoRoot });
    assert.equal(resolver.repo.edition, edition);
    assert.equal(resolver.repo.profile, 'be');
    assert.equal(resolver.classifyPath(TRANSPORT).slot, 'be.transport.graphql');
    const check = () => contractFindings({ repoRoot, files, repo: resolver.repo, resolver });
    const [missing] = check();
    assert.equal(missing.code, CODE);
    assert.equal(missing.level, 'error');
    assert.equal(missing.path, SNAPSHOT);
    assert.equal(missing.app, 'api');
    write(SNAPSHOT, 'type Query {\n  ping: String\n}\n');
    assert.deepEqual(check(), []);
  });
}
