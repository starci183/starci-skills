// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@lite
// proves: HFS_CONTRACT_SNAPSHOT_DRIFT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';
import { contractFindings } from '../runtime/scripts/hfs/rules/contract.mjs';

const SNAPSHOT = 'contracts/api/schema.graphql';
const TRANSPORT = 'src/features/api/orders/transport/graphql/orders-graphql.module.ts';

function contractInput(t, edition, withSnapshot) {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-direct-contract-'));
  t.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));
  const repoRoot = path.join(appRoot, 'be');
  fs.writeFileSync(path.join(appRoot, 'hfs.json'), JSON.stringify({
    hfs: 3, kind: 'app', project: 'proof', edition,
    sides: {
      be: { apps: [{ name: 'api', kind: 'api' }], optionalSlots: ['be.contract.graphql'] },
      fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
    },
  }));
  const contents = [
    ['apps/api/src/app.module.ts', "import { GraphqlModule } from '@modules/platform/graphql';\nexport const modules = [GraphqlModule];\n"],
    [TRANSPORT, 'export class OrdersGraphqlModule {}\n'],
  ];
  if (withSnapshot) contents.push([SNAPSHOT, 'type Query {\n  ping: String\n}\n']);
  for (const [file, text] of contents) {
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  const resolver = openHfs({ repoRoot });
  return { repoRoot, files: contents.map(([file]) => file), repo: resolver.repo, resolver };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} invalid: a GraphQL app missing its committed snapshot is refused`, t => {
    const input = contractInput(t, edition, false);
    assert.equal(input.repo.edition, edition);
    assert.deepEqual(contractFindings(input).map(item => item.code), ['HFS_CONTRACT_SNAPSHOT_DRIFT']);
  });

  test(`${edition} valid: a GraphQL app with its committed snapshot passes`, t => {
    const input = contractInput(t, edition, true);
    assert.equal(input.repo.edition, edition);
    assert.deepEqual(contractFindings(input), []);
    assert.equal(contractFindings(input).some(item => item.code === 'HFS_CONTRACT_SNAPSHOT_DRIFT'), false);
  });
}
