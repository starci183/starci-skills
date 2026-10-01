// The green proofs a fixture that settles a code-writing op attaches: the sonar-local scan summary (knowledge/sonar-gate.yaml
// enforcedOps) and the op loop's gate.json and read-digest.json (knowledge/op-gate.yaml enforcedOps). The settle reads what
// the op attached and refuses a pass without them. These fixtures test other behaviour, so what they attach is the honest
// "slice meets the gate, READ done" record.
import fs from 'node:fs';
import path from 'node:path';
import { loadSonarGate, thresholdsOf } from '../../scripts/checks/sonar-gate.mjs';
import { GATE_SCHEMA } from '../../scripts/checks/gate.mjs';
import { DIGEST_SCHEMA } from '../../scripts/checks/read-digest.mjs';

export const greenSonarScan = () => ({
  schema: 'starci/sonar-local-scan@3', at: new Date().toISOString(), scope: 'slice', outcome: 'pass',
  gate: thresholdsOf(loadSonarGate()), slice: { verdict: 'pass', failures: [] },
});

export const greenGate = () => ({ schema: GATE_SCHEMA, at: new Date().toISOString(), root: '.', base: null, head: null, changed: [], exit: 0, ok: true,
  steps: {}, counts: { new: 0, preexisting: 0 }, findings: [], errors: [] });
export const greenReadDigest = () => ({ schema: DIGEST_SCHEMA, at: new Date().toISOString(), root: '.', touched: [], slotMap: [],
  files: [{ path: 'knowledge/patterns/be/service.yaml', role: 'pattern', sha256: 'a'.repeat(64) }] });

/** The file names writeGreenProofs writes, in order. */
export const GREEN_PROOF_FILES = Object.freeze(['sonar.json', 'gate.json', 'read-digest.json']);
/** Write the green sonar.json, gate.json and read-digest.json into <dir>; their absolute paths, ready for a report's `files`. */
export const writeGreenProofs = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const docs = [greenSonarScan(), greenGate(), greenReadDigest()];
  return GREEN_PROOF_FILES.map((name, i) => { const file = path.join(dir, name); fs.writeFileSync(file, JSON.stringify(docs[i])); return file; });
};
