// R299: GitHub Actions expressions use only contexts available at their workflow key.
import { parseWorkflow, workflowFindings } from '../runtime-rules/workflow-source.mjs';
import { found, readText } from './read.mjs';

const WORKFLOW = ['github', 'inputs', 'vars'];
const JOB_IF = ['github', 'needs', 'vars', 'inputs'];
const JOB = [...JOB_IF, 'strategy', 'matrix'];
const JOB_ENV = [...JOB, 'secrets'];
const EXECUTION = [...JOB_ENV, 'job', 'runner', 'env'];
const CONTEXTS = [...EXECUTION, 'steps'];
const JOB_KEYS = new Set(['name', 'runs-on', 'concurrency', 'strategy', 'timeout-minutes', 'continue-on-error', 'with']);

/** Container and service images are chosen before a runner exists; their other properties use execution contexts. */
function containerContexts(keys) {
  if (keys[2] === 'services') return keys[4] === 'image' ? JOB : EXECUTION;
  return keys.length === 3 || keys[3] === 'image' ? JOB : EXECUTION;
}

/** The most specific row of GitHub's Context availability table governs each descendant value. */
function jobContexts(keys) {
  const key = keys[2];
  if (key === 'steps') return CONTEXTS;
  if (key === 'if') return JOB_IF;
  if (key === 'strategy') return JOB_IF;
  if (key === 'env' || key === 'secrets') return JOB_ENV;
  if (key === 'outputs') return CONTEXTS;
  if (key === 'defaults' && keys[3] === 'run') return [...JOB, 'env'];
  if (key === 'environment') return keys[3] === 'url' ? CONTEXTS.filter((context) => context !== 'secrets') : JOB;
  if (key === 'container' || key === 'services') return containerContexts(keys);
  if (JOB_KEYS.has(key)) return JOB;
  return [];
}

/** Unlisted workflow keys admit no contexts; reusable workflow outputs alone may read jobs. */
function allowedContexts(keys) {
  if (keys[0] === 'jobs') return jobContexts(keys);
  if (keys[0] === 'env') return [...WORKFLOW, 'secrets'];
  if (keys[0] === 'run-name' || keys[0] === 'concurrency') return WORKFLOW;
  if (keys.slice(0, 3).join('.') === 'on.workflow_call.inputs' && keys[4] === 'default') return WORKFLOW;
  if (keys.slice(0, 3).join('.') === 'on.workflow_call.outputs' && keys[4] === 'value') return [...WORKFLOW, 'jobs'];
  return [];
}

/** Strings and property names are not context roots; bracket access and case-insensitive roots still are. */
function expressionContexts(expression) {
  const unquoted = expression.replace(/'(?:[^']|'')*'/g, ' ');
  const tokens = unquoted.match(/[A-Za-z_][\w-]*|[^\s]/g) ?? [];
  const roots = tokens.filter((token, index) => tokens[index - 1] !== '.' &&
    ([...CONTEXTS, 'jobs'].includes(token.toLowerCase()) || ['.', '['].includes(tokens[index + 1]))).map((token) => token.toLowerCase());
  return [...new Set(roots)];
}

/** A closing delimiter inside an Actions single-quoted string cannot end an expression. */
function expressionEnd(value, start) {
  let quoted = false;
  for (let index = start; index < value.length; index++) {
    if (value[index] === "'") quoted = !quoted;
    if (!quoted && value.slice(index, index + 2) === '}}') return index;
  }
  return value.length;
}

/** Read marked expressions without ambiguous regex repetition or losing delimiters inside string literals. */
function expressions(value) {
  const result = [];
  const marker = /\$\{\{ __hfs_context_line_(\d+)__ /g;
  let match;
  while ((match = marker.exec(value)) !== null) {
    const end = expressionEnd(value, marker.lastIndex);
    result.push({ line: Number(match[1]), body: value.slice(marker.lastIndex, end) });
    marker.lastIndex = end + 2;
  }
  return result;
}

/** Source markers travel inside parsed scalar expressions, preserving flow maps, quoted keys and repeated values without matching comments. */
export function workflowContextFindings({ path: file, text }) {
  const marked = text.replace(/\$\{\{/g, (match, offset) => `${match} __hfs_context_line_${text.slice(0, offset).split('\n').length}__ `);
  const findings = [];
  function inspect(value, keys) {
    const allowed = allowedContexts(keys);
    for (const { line, body } of expressions(value)) {
      for (const context of expressionContexts(body)) {
        if (allowed.includes(context)) continue;
        const keyPath = keys.join('.');
        findings.push(found('HFS_WORKFLOW_CONTEXT', file, `HFS_WORKFLOW_CONTEXT: ${file}:${line}: ${keyPath} forbids context ${context}.`, { line, keyPath, context }));
      }
    }
  }
  function visit(value, keys = []) {
    if (typeof value === 'string') inspect(value, keys);
    if (!value || typeof value !== 'object') return;
    for (const [key, member] of Object.entries(value)) visit(member, [...keys, key]);
  }
  visit(parseWorkflow(marked));
  return findings;
}

/** Judge every tracked workflow in scope at the full or lite app root, using the shared workflow selector. */
export function workflowContextsFindings({ repoRoot, files, all = files, repo, isRoot, inScope = () => true }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  return workflowFindings({ files: [...new Set(all)].filter((file) => inScope(file)), read: (file) => readText(repoRoot, file) }, workflowContextFindings);
}
