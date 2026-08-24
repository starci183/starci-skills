import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const defaultGraphPath = path.resolve(scriptDir, '..', 'graph.json');

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

export function normalizeGuard(guard) {
  return {
    stage: guard.stage,
    status: guard.status,
    allFacts: [...list(guard.allFacts)].sort(),
    noneFacts: [...list(guard.noneFacts)].sort()
  };
}

export function guardsEqual(left, right) {
  const a = normalizeGuard(left);
  const b = normalizeGuard(right);
  return a.stage === b.stage
    && a.status === b.status
    && sameSet(a.allFacts, b.allFacts)
    && sameSet(a.noneFacts, b.noneFacts);
}

export function guardMatches(guard, envelope) {
  const facts = list(envelope.facts);
  return envelope.stage === guard.stage
    && envelope.status === guard.status
    && list(guard.allFacts).every((fact) => facts.includes(fact))
    && list(guard.noneFacts).every((fact) => !facts.includes(fact));
}

export function selectRoute(graph, envelope) {
  const matches = graph.routes.filter((route) => guardMatches(route.when, envelope));
  if (matches.length === 0) {
    throw new Error(`No route for ${envelope.stage}/${envelope.status} with facts [${list(envelope.facts).join(', ')}]`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous routes for ${envelope.stage}/${envelope.status}`);
  }
  return matches[0];
}

export function loadSelectedOperation(graphPath, graph, route) {
  if (route.target.kind !== 'operation') return null;
  const relativeManifest = graph.nodes[route.target.ref];
  if (!relativeManifest) throw new Error(`Unknown operation node: ${route.target.ref}`);

  const operationPath = path.resolve(path.dirname(graphPath), graph.operationRoot, relativeManifest);
  const operation = readJson(operationPath);
  const accepts = operation.accepts;
  if (!Array.isArray(accepts) || !accepts.some((guard) => guardsEqual(guard, route.when))) {
    throw new Error(`Route guard drift for operation ${route.target.ref}`);
  }
  return {
    id: operation.id,
    directory: path.dirname(operationPath),
    operationPath,
    inputSchemaPath: path.join(path.dirname(operationPath), operation.inputSchema),
    outputSchemaPath: path.join(path.dirname(operationPath), operation.outputSchema),
    inputValidatorPath: path.join(path.dirname(operationPath), 'validate-input.mjs'),
    outputValidatorPath: path.join(path.dirname(operationPath), 'validate-output.mjs'),
    knowledgeRefs: operation.knowledgeRefs ?? [],
    operation
  };
}

export function routeEnvelope(envelope, graphPath = defaultGraphPath) {
  const graph = readJson(graphPath);
  const route = selectRoute(graph, envelope);
  const operation = loadSelectedOperation(graphPath, graph, route);
  return { target: route.target, operation };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envelopePath = process.argv[2];
  if (!envelopePath) {
    console.error('Usage: node route-app.mjs <envelope.json> [graph.json]');
    process.exit(2);
  }
  try {
    const result = routeEnvelope(readJson(path.resolve(envelopePath)), process.argv[3] ? path.resolve(process.argv[3]) : defaultGraphPath);
    console.log(JSON.stringify({
      target: result.target,
      operation: result.operation && {
        id: result.operation.id,
        directory: result.operation.directory,
        operationPath: result.operation.operationPath,
        inputSchemaPath: result.operation.inputSchemaPath,
        outputSchemaPath: result.operation.outputSchemaPath,
        inputValidatorPath: result.operation.inputValidatorPath,
        outputValidatorPath: result.operation.outputValidatorPath,
        knowledgeRefs: result.operation.knowledgeRefs
      }
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
