import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  defaultGraphPath,
  loadSelectedOperation,
  readJson,
  routeEnvelope,
  selectRoute
} from './route-app.mjs';

function exampleFor(guard) {
  return {
    schemaVersion: 6,
    appId: 'fe-design-layout',
    runId: 'route-test',
    stage: guard.stage,
    status: guard.status,
    facts: [...(guard.allFacts ?? [])],
    payload: {}
  };
}

test('every declared route is uniquely selectable and every operation guard agrees', () => {
  const graph = readJson(defaultGraphPath);
  for (const expected of graph.routes) {
    const envelope = exampleFor(expected.when);
    const selected = selectRoute(graph, envelope);
    assert.deepEqual(selected, expected);
    if (expected.target.kind === 'operation') {
      const loaded = loadSelectedOperation(defaultGraphPath, graph, selected);
      assert.equal(typeof loaded.operation.id, 'string');
    }
  }
});

test('routing fails closed when no guard matches', () => {
  const graph = readJson(defaultGraphPath);
  assert.throws(
    () => selectRoute(graph, { stage: 'unknown', status: 'ready', facts: [] }),
    /No route/
  );
});

test('routing fails closed when two guards match', () => {
  const graph = readJson(defaultGraphPath);
  const duplicated = { ...graph, routes: [graph.routes[0], graph.routes[0]] };
  assert.throws(() => selectRoute(duplicated, exampleFor(graph.routes[0].when)), /Ambiguous routes/);
});

test('selected operation is loaded only after routing and guard drift is rejected', () => {
  const graph = readJson(defaultGraphPath);
  const first = graph.routes.find((route) => route.target.kind === 'operation');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-v6-route-'));
  try {
    const operationRoot = path.join(tempRoot, 'operations');
    fs.mkdirSync(path.join(operationRoot, 'selected'), { recursive: true });
    fs.writeFileSync(path.join(operationRoot, 'selected', 'operation.json'), JSON.stringify({
      id: 'fe/selected', inputSchema: 'input.schema.json', outputSchema: 'output.schema.json', accepts: [{ stage: 'different', status: 'ready' }]
    }));
    const tempGraphPath = path.join(tempRoot, 'graph.json');
    const tempGraph = {
      ...graph,
      operationRoot: './operations',
      nodes: { selected: 'selected/operation.json' },
      routes: [{ when: first.when, target: { kind: 'operation', ref: 'selected' } }]
    };
    fs.writeFileSync(tempGraphPath, JSON.stringify(tempGraph));
    assert.throws(() => routeEnvelope(exampleFor(first.when), tempGraphPath), /Route guard drift/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
