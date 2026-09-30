// A green sonar-local scan summary for fixtures that settle a code-writing op (knowledge/sonar-gate.yaml enforcedOps):
// the settle reads the sonar.json the op attached and refuses a pass without one. These fixtures test other behaviour, so
// the scan they attach is the honest "slice meets the gate" summary, built from the one gate file.
import fs from 'node:fs';
import path from 'node:path';
import { loadSonarGate, thresholdsOf } from '../../scripts/checks/sonar-gate.mjs';

export const greenSonarScan = () => ({
  schema: 'starci/sonar-local-scan@3', at: new Date().toISOString(), scope: 'slice', outcome: 'pass',
  gate: thresholdsOf(loadSonarGate()), slice: { verdict: 'pass', failures: [] },
});

/** Write the green scan as <dir>/sonar.json and return its absolute path, ready for a report's `files`. */
export const writeGreenSonar = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'sonar.json');
  fs.writeFileSync(file, JSON.stringify(greenSonarScan()));
  return file;
};
