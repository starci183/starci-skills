#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode)) throw new Error('usage: node migration/v7/route-machines-on-output.mjs [--check|--write]');

const operatorsRoot = path.join(runtimeRoot, 'operators');
const skillsRoot = path.join(runtimeRoot, 'skills');
const operators = new Map();
const legacyRouteOutcomes = {
  'test/unit': {
    'test.e2e\u0000ready': 'pass',
    'code.repair\u0000repair': 'in-boundary',
    'test.review\u0000blocked': 'blocked'
  },
  'test/e2e': {
    'test.ui\u0000ready': 'pass',
    'code.repair\u0000repair': 'in-boundary',
    'test.review\u0000blocked': 'blocked'
  },
  'test/ui': {
    'proof.run\u0000ready': 'pass',
    'code.repair\u0000repair': 'in-boundary',
    'layout.review\u0000rejected': 'boundary-drift',
    'test.review\u0000blocked': 'blocked'
  }
};

for (const domain of fs.readdirSync(operatorsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  for (const operation of fs.readdirSync(path.join(operatorsRoot, domain.name), { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const directory = path.join(operatorsRoot, domain.name, operation.name);
    const manifestPath = path.join(directory, 'operator.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 7) continue;
    const output = JSON.parse(fs.readFileSync(path.join(directory, 'output.schema.json'), 'utf8'));
    const outcomeRule = output.properties?.output?.properties?.outcome;
    const outcomes = outcomeRule?.enum ?? (outcomeRule?.const === undefined ? [] : [outcomeRule.const]);
    operators.set(manifest.id, new Set(outcomes));
  }
}

const changed = [];
const unresolved = [];
for (const skill of fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  const machinePath = path.join(skillsRoot, skill.name, 'machine.json');
  if (!fs.existsSync(machinePath)) continue;
  const machine = JSON.parse(fs.readFileSync(machinePath, 'utf8'));
  let dirty = false;
  for (const [stateId, state] of Object.entries(machine.states ?? {})) {
    if (state.kind !== 'operator' || !operators.has(state.ref)) continue;
    const outcomes = operators.get(state.ref);
    for (const edge of state.on ?? []) {
      const when = edge.when ?? {};
      if (when.decision !== undefined) {
        if (!outcomes.has(when.decision)) {
          unresolved.push(`${machine.id}/${stateId}: decision ${when.decision} is absent from ${state.ref} output.outcome`);
          continue;
        }
        const { decision, ...rest } = when;
        edge.when = { outputEquals: { outcome: decision }, ...rest };
        dirty = true;
      } else if ((when.stage !== undefined || when.status !== undefined) && when.outputEquals === undefined) {
        const key = `${when.stage ?? ''}\u0000${when.status ?? ''}`;
        const outcome = legacyRouteOutcomes[state.ref]?.[key];
        if (!outcome || !outcomes.has(outcome)) {
          unresolved.push(`${machine.id}/${stateId}: stage/status route needs an explicit ${state.ref} outcome mapping`);
          continue;
        }
        edge.when = { outputEquals: { outcome } };
        dirty = true;
      }
    }
  }
  if (!dirty) continue;
  changed.push(path.relative(runtimeRoot, machinePath).replaceAll('\\', '/'));
  if (mode === '--write') fs.writeFileSync(machinePath, `${JSON.stringify(machine, null, 2)}\n`);
}

console.log(JSON.stringify({ mode, v7Operators: operators.size, changedCount: changed.length, changed, unresolved }, null, 2));
if (mode === '--check' && (changed.length > 0 || unresolved.length > 0)) process.exitCode = 1;
