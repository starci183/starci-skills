// lite-proof-lane.mjs - R284: declared patterns in lite prove their scenarios in integration specs.
// Full keeps its existing e2e/integration proof checks. R155 owns BE_PATTERN_SPEC_MISSING in both editions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSlotManifest, ruleParams } from '../slots.mjs';
import { loadTypescript } from '../../lib/package-at.mjs';
import { literalText } from '../../lib/ts-ast.mjs';
import { found, readText } from './read.mjs';

const LITE_PROOF_LANE_MISSING = 'BE_LITE_PROOF_LANE_MISSING';
const PATTERN_SPEC_MISSING = 'BE_PATTERN_SPEC_MISSING';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const INTEGRATION_SPEC = /^be\/src\/tests\/integration\/.+\.integration-spec\.ts$/;
const PATTERNS = new Set(['event-bus', 'queue', 'webhooks', 'realtime', 'fenced-job', 'projection', 'saga']);
// Fallback saga scenarios until the shared manifest provides its scenario table.
const SAGA_SCENARIOS = ['compensation-on-failure', 'step-order', 'state-version-fences', 'consumer-dedupes'];

/** A disabled test/suite must not contribute its own title or any nested test titles. */
function disabledCall(ts, node) {
  let callee = node.expression;
  let disabled = false;
  while (ts.isPropertyAccessExpression(callee) || ts.isCallExpression(callee)) {
    if (ts.isPropertyAccessExpression(callee) && ['skip', 'todo'].includes(callee.name.text)) disabled = true;
    callee = callee.expression;
  }
  return ts.isIdentifier(callee) && (callee.text === 'xdescribe'
    || (disabled && ['it', 'test', 'describe'].includes(callee.text)));
}

/** A test callback is an inline function or a reference to one, rather than a missing/placeholder value. */
function hasCallback(ts, node) {
  const callback = node.arguments[1];
  return callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)
    || (ts.isIdentifier(callback) && callback.text !== 'undefined') || ts.isPropertyAccessExpression(callback));
}

/** Add scenario ids from literal it/test titles with callbacks; disabled suites and source text provide no proof. */
function addScenarios(ts, source, proven) {
  const visit = (node) => {
    if (ts.isCallExpression(node) && disabledCall(ts, node)) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && ['it', 'test'].includes(node.expression.text) && hasCallback(ts, node)) {
      const title = literalText(ts, node.arguments[0]);
      const colon = title?.indexOf(':') ?? -1;
      if (colon > 0) proven.add(title.slice(0, colon));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

/** Only tracked, readable integration specs belong to lite's proof lane. */
function integrationProof(ts, repoRoot, files) {
  const proven = new Set();
  const specs = [];
  for (const file of files) {
    if (!INTEGRATION_SPEC.test(file)) continue;
    const text = readText(repoRoot, file);
    if (text === null) continue;
    specs.push(file);
    if (ts) addScenarios(ts, ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), proven);
  }
  return { specs, proven };
}

/** Findings of R284 and R155 at the app root; side passes must not duplicate them. */
export function liteProofLaneFindings({ repoRoot, files, all = files, repo, manifest }) {
  if (repo.edition !== 'lite' || !repo.sides?.be) return [];
  const patterns = [...new Set(repo.sides.be.patterns ?? [])].filter((pattern) => PATTERNS.has(pattern));
  if (patterns.length === 0) return [];
  const scenarios = ruleParams(manifest ?? loadSlotManifest(), 'be', 'lite').patternScenarios ?? {};
  const ts = loadTypescript(repoRoot, HERE);
  const { specs, proven } = integrationProof(ts, repoRoot, all);
  const findings = [];
  if (specs.length === 0) {
    const declared = patterns.map((pattern) => `\`${pattern}\``).join(', ');
    findings.push(found(LITE_PROOF_LANE_MISSING, 'hfs.json',
      `Lite declares ${declared} but has no tracked integration spec in be/src/tests/integration; add *.integration-spec.ts with the declared patterns' scenario titles.`, { patterns }));
  }
  for (const pattern of patterns) {
    const required = scenarios[pattern] ?? (pattern === 'saga' ? SAGA_SCENARIOS : []);
    for (const scenario of required) {
      const id = `${pattern}/${scenario}`;
      if (!proven.has(id)) findings.push(found(PATTERN_SPEC_MISSING, 'hfs.json',
        `The lite pattern \`${pattern}\` is declared but no integration spec in be/src/tests/integration holds a test titled \`${id}: ...\`; prove this scenario in the lite integration lane.`, { pattern, scenario: id }));
    }
  }
  return findings;
}
