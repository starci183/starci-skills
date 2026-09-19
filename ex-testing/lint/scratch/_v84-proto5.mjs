// v8-4 scratch: how is a journey's uat demand answered today, and does any record type pair otherwise?
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';
import {walk} from '../../../scripts/check-example-work.mjs';
import {loadRecords} from '../../../scripts/example-ownership.mjs';

const root = path.resolve(process.cwd());
for (const t of ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork']) {
  const workRoot = path.resolve(root, t);
  const records = loadRecords(workRoot, walk);
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/customer-journey') continue;
    const hasEvidence = fs.existsSync(path.join(rec.dir, 'evidence.yaml'));
    const claimed = [...records.values()].filter(other => Array.isArray(other.data.proves) && other.data.proves.includes(id));
    console.log(`${t} ${id} state=${rec.data.state} evidence=${hasEvidence} requiresProof=${JSON.stringify(rec.data.requiresProof)} claimedBy=${claimed.map(c => c.id + '/' + c.schema + '/' + c.data.state).join(', ') || '(nobody)'}`);
  }
  for (const [id, rec] of records) {
    if (rec.schema !== 'work/sds-component') continue;
    const claimed = [...records.values()].filter(other => Array.isArray(other.data.proves) && other.data.proves.includes(id));
    if (!claimed.length && rec.data.state === 'done') console.log(`${t} SDS-DONE-UNPROVEN ${id} requiresProof=${JSON.stringify(rec.data.requiresProof)}`);
  }
  const nfrDone = [...records.values()].filter(r => r.schema === 'work/non-functional-requirement' && r.data.state === 'done');
  for (const rec of nfrDone) console.log(`${t} NFR ${rec.id} requiresProof=${JSON.stringify(rec.data.requiresProof)} evidence=${fs.existsSync(path.join(rec.dir, 'evidence.yaml'))}`);
}
