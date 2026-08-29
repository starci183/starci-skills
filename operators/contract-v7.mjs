import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exactly = (actual, expected) => {
  const left = [...new Set(actual ?? [])].sort();
  const right = [...expected].sort();
  return JSON.stringify(left) === JSON.stringify(right);
};

const isClosedObject = (rule) => rule?.type === 'object'
  && rule.additionalProperties === false
  && rule.properties
  && typeof rule.properties === 'object';

const directDescriptions = (rule, location, issues) => {
  for (const [name, property] of Object.entries(rule?.properties ?? {})) {
    if (typeof property.description !== 'string' || property.description.trim().length === 0) {
      issues.push(`${location}.${name}: semantic description is required`);
    }
  }
};

export function operatorV7Issues({ manifest, inputSchema, outputSchema }) {
  const issues = [];
  const id = manifest?.id;

  if (manifest?.schemaVersion !== 7) issues.push('operator.json.schemaVersion must be 7');
  if (typeof manifest?.job !== 'string' || manifest.job.trim().length === 0) issues.push('operator.json.job must name the one job');
  if ('accepts' in (manifest ?? {}) || 'emits' in (manifest ?? {})) issues.push('operator.json cannot own accepts/emits routing');
  if ('knowledgeRefs' in (manifest ?? {})) issues.push('operator.json cannot own legacy knowledgeRefs in v7');

  if (!isClosedObject(inputSchema)) issues.push('input schema root must be a closed object');
  if (!exactly(inputSchema?.required, ['schemaVersion', 'operatorId', 'context', 'input'])) {
    issues.push('input root must require only schemaVersion, operatorId, context, input');
  }
  if (!exactly(Object.keys(inputSchema?.properties ?? {}), ['schemaVersion', 'operatorId', 'context', 'input'])) {
    issues.push('input root can contain only schemaVersion, operatorId, context, input');
  }
  if (inputSchema?.properties?.schemaVersion?.const !== 7) issues.push('input schemaVersion must be 7');
  if (inputSchema?.properties?.operatorId?.const !== id) issues.push('input operatorId must equal manifest id');
  for (const key of ['context', 'input']) {
    const rule = inputSchema?.properties?.[key];
    if (!isClosedObject(rule)) issues.push(`input.${key} must be a closed typed object`);
    else directDescriptions(rule, `input.${key}`, issues);
  }

  if (!isClosedObject(outputSchema)) issues.push('output schema root must be a closed object');
  if (!exactly(outputSchema?.required, ['schemaVersion', 'operatorId', 'output'])) {
    issues.push('output root must require only schemaVersion, operatorId, output');
  }
  if (!exactly(Object.keys(outputSchema?.properties ?? {}), ['schemaVersion', 'operatorId', 'output'])) {
    issues.push('output root can contain only schemaVersion, operatorId, output');
  }
  if (outputSchema?.properties?.schemaVersion?.const !== 7) issues.push('output schemaVersion must be 7');
  if (outputSchema?.properties?.operatorId?.const !== id) issues.push('output operatorId must equal manifest id');
  const output = outputSchema?.properties?.output;
  if (!isClosedObject(output)) issues.push('output.output must be a closed typed object');
  else {
    directDescriptions(output, 'output.output', issues);
    for (const leaked of ['stage', 'status', 'facts', 'decision', 'state', 'emits', 'cleanup']) {
      if (leaked in output.properties) issues.push(`output.output.${leaked}: Skill/runtime routing field leaked into operator output`);
    }
  }

  const serialized = JSON.stringify({ manifest, inputSchema, outputSchema }).toLowerCase();
  if (serialized.includes('qdrant') || serialized.includes('qdrant-exact')) {
    issues.push('v7 operator contract cannot depend on Qdrant; resolve exact context with default search');
  }

  return issues;
}

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

export function auditOperatorRoot(root) {
  const manifests = walk(root).filter((file) => path.basename(file) === 'operator.json');
  const operators = manifests.map((manifestFile) => {
    const directory = path.dirname(manifestFile);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const inputSchema = JSON.parse(fs.readFileSync(path.join(directory, manifest.inputSchema ?? 'input.schema.json'), 'utf8'));
    const outputSchema = JSON.parse(fs.readFileSync(path.join(directory, manifest.outputSchema ?? 'output.schema.json'), 'utf8'));
    const issues = operatorV7Issues({ manifest, inputSchema, outputSchema });
    return { id: manifest.id, version: manifest.schemaVersion, ready: issues.length === 0, issues };
  });
  return {
    schemaVersion: 1,
    total: operators.length,
    ready: operators.filter((item) => item.ready).length,
    remaining: operators.filter((item) => !item.ready).length,
    operators
  };
}

const invoked = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
if (invoked) {
  const root = path.resolve(process.argv[2] ?? path.dirname(fileURLToPath(import.meta.url)));
  const report = auditOperatorRoot(root);
  const emitted = process.argv.includes('--details')
    ? report
    : { schemaVersion: report.schemaVersion, total: report.total, ready: report.ready, remaining: report.remaining };
  process.stdout.write(`${JSON.stringify(emitted, null, 2)}\n`);
  if (process.argv.includes('--strict') && report.remaining > 0) process.exitCode = 1;
}
