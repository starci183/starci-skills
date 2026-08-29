import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const { outcome, uxFlowGraph: graph, gaps } = value.output;
  const errors = [];
  if (outcome === 'modeled' && (graph === null || gaps.length > 0)) errors.push('/output: modeled requires one graph and zero authority gaps');
  if (outcome === 'blocked' && (graph !== null || gaps.length === 0)) errors.push('/output: blocked requires null graph and exact authority gaps');
  if (!graph) return errors;
  const ids = graph.nodes.map((node) => node.id);
  if (new Set(ids).size !== ids.length) errors.push('/output/uxFlowGraph/nodes: node ids must be unique');
  const known = new Set(ids);
  for (const transition of graph.transitions) {
    if (!known.has(transition.from) || !known.has(transition.to)) errors.push('/output/uxFlowGraph/transitions: every endpoint must name a node');
  }
  if (!graph.nodes.some((node) => node.kind === 'entry')) errors.push('/output/uxFlowGraph/nodes: one entry is required');
  if (!graph.nodes.some((node) => ['result', 'safe-terminal'].includes(node.kind))) errors.push('/output/uxFlowGraph/nodes: one result or safe terminal is required');
  return errors;
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
