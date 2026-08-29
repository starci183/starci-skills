import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const operatorRoot = path.join(runtimeRoot, 'operators');
const domains = new Set(['deployment', 'quality', 'test', 'workspace']);
const write = process.argv.includes('--write');

const refs = {
  type: 'array',
  maxItems: 128,
  uniqueItems: true,
  items: { type: 'string', minLength: 1, maxLength: 1024 }
};
const sha256 = { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' };

function decisionsFrom(node, found = new Set()) {
  if (!node || typeof node !== 'object') return found;
  if (node.properties?.decision) {
    const rule = node.properties.decision;
    if (typeof rule.const === 'string') found.add(rule.const);
    for (const value of rule.enum ?? []) if (typeof value === 'string') found.add(value);
  }
  for (const value of Object.values(node)) decisionsFrom(value, found);
  return found;
}

function sentenceJob(directory, id) {
  const execute = fs.readFileSync(path.join(directory, 'execute.md'), 'utf8');
  const match = execute.match(/This operator\s+([^\r\n.]+\.)/i);
  if (match) return `${match[1][0].toUpperCase()}${match[1].slice(1)}`;
  const action = id.split('/')[1].replaceAll('-', ' ');
  return `Produce one bounded ${action} result from exact supplied evidence.`;
}

function inputSchema(id) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://starci.dev/v7/operators/${id}/input.schema.json`,
    type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'operatorId', 'context', 'input'],
    properties: {
      schemaVersion: { const: 7 },
      operatorId: { const: id },
      context: {
        type: 'object', additionalProperties: false,
        required: ['contextRefs', 'sourceRefs'],
        properties: {
          contextRefs: { description: 'Exact canonical references resolved with default repository or file search.', $ref: '#/$defs/refs' },
          sourceRefs: { description: 'Exact routed source references allowed for this job.', $ref: '#/$defs/refs' }
        }
      },
      input: {
        type: 'object', additionalProperties: false,
        required: ['project', 'objectiveRef', 'sourceFingerprint'],
        properties: {
          project: { description: 'Verified project identity for this job.', type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$' },
          objectiveRef: { description: 'Exact bounded objective reference.', type: 'string', minLength: 1, maxLength: 1024 },
          sourceFingerprint: { description: 'Frozen fingerprint for the supplied source evidence.', $ref: '#/$defs/sha256' }
        }
      }
    },
    $defs: { sha256, refs }
  };
}

function outputSchema(id, outcomes) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://starci.dev/v7/operators/${id}/output.schema.json`,
    type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'operatorId', 'output'],
    properties: {
      schemaVersion: { const: 7 }, operatorId: { const: id },
      output: {
        type: 'object', additionalProperties: false,
        required: ['outcome', 'resultRef', 'evidenceRefs', 'findings', 'reason'],
        properties: {
          outcome: { description: 'Typed atomic result consumed by the parent Skill machine.', enum: outcomes },
          resultRef: { description: 'Exact produced artifact or receipt reference, or null.', type: ['string', 'null'], minLength: 1, maxLength: 1024 },
          evidenceRefs: { description: 'Exact references supporting the result.', $ref: '#/$defs/refs' },
          findings: { description: 'Bounded observable findings produced by this job.', type: 'array', maxItems: 128, items: { type: 'string', minLength: 1, maxLength: 2048 } },
          reason: { description: 'Bounded explanation when no result is produced, otherwise null.', type: ['string', 'null'], minLength: 1, maxLength: 2048 }
        }
      }
    },
    $defs: { refs }
  };
}

function docs(id, job, outcomes) {
  return {
    'input.md': `# \`${id}\` input\n\n- \`context.contextRefs\`: exact canonical references resolved by default repository or file search.\n- \`context.sourceRefs\`: exact routed source files permitted for this job.\n- \`input.project\`: verified project identity.\n- \`input.objectiveRef\`: exact bounded objective reference.\n- \`input.sourceFingerprint\`: frozen fingerprint for supplied evidence.\n\nThe runtime Source resolves routes through \`.claude/.workspaces\`; project authority lives only in the verified backend Source under flat \`.worktrees/<kind>\`.\n`,
    'execute.md': `# Execute \`${id}\`\n\n## Context\n\nResolve only the supplied exact references with default repository or file search. Verify their frozen fingerprint and routed project identity.\n\n## Input\n\nBind all work to the verified project and one bounded objective.\n\n## Action\n\n${job} Do not route later work, own workflow state, broaden source scope, or perform another operator's job.\n\n## Output\n\nReturn only one atomic result: \`outcome\`, \`resultRef\`, \`evidenceRefs\`, \`findings\`, and \`reason\`.\n\n## Stop\n\nReturn the applicable non-success outcome when evidence is missing, fingerprints drift, or the requested work exceeds this single job.\n`,
    'output.md': `# \`${id}\` output\n\n- \`output.outcome\`: one of ${outcomes.map((item) => `\`${item}\``).join(', ')}.\n- \`output.resultRef\`: exact produced artifact or receipt reference, or null.\n- \`output.evidenceRefs\`: exact supporting references.\n- \`output.findings\`: bounded observable findings.\n- \`output.reason\`: bounded explanation when no result is produced, otherwise null.\n`
  };
}

const inputValidator = `import { validatorFor, runValidatorCli } from '../../validation.mjs';\n\nexport const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {\n  const refs = [...value.context.contextRefs, ...value.context.sourceRefs];\n  return refs.length === 0 ? ['at least one exact context or source reference is required'] : [];\n});\n\nif (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');\n`;
const outputValidator = `import { validatorFor, runValidatorCli } from '../../validation.mjs';\n\nexport const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {\n  const issues = [];\n  if (value.output.resultRef === null && value.output.reason === null) issues.push('resultRef and reason cannot both be null');\n  return issues;\n});\n\nif (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');\n`;

const changed = [];
for (const domain of domains) {
  const domainRoot = path.join(operatorRoot, domain);
  for (const entry of fs.readdirSync(domainRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(domainRoot, entry.name);
    const manifestFile = path.join(directory, 'operator.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    if (manifest.schemaVersion === 7) continue;
    const id = manifest.id;
    const legacyOutput = JSON.parse(fs.readFileSync(path.join(directory, manifest.outputSchema ?? 'output.schema.json'), 'utf8'));
    const outcomes = [...decisionsFrom(legacyOutput)].sort();
    if (outcomes.length === 0) outcomes.push('ready', 'blocked');
    const job = sentenceJob(directory, id);
    const nextManifest = {
      schemaVersion: 7, id, domain,
      job,
      inputSchema: 'input.schema.json', outputSchema: 'output.schema.json', sourceReferenceRefs: [],
      sideEffects: (manifest.sideEffects ?? []).filter((item) => !/session|purge|input, output|scratch|observation|receipt/i.test(item)),
      stopConditions: [
        'an exact reference is missing or its fingerprint differs',
        'the requested work exceeds this operator job'
      ]
    };
    if (nextManifest.sideEffects.length === 0) nextManifest.sideEffects = ['read only the supplied exact references'];
    const generatedDocs = docs(id, job, outcomes);
    const files = {
      'operator.json': `${JSON.stringify(nextManifest, null, 2)}\n`,
      'input.schema.json': `${JSON.stringify(inputSchema(id), null, 2)}\n`,
      'output.schema.json': `${JSON.stringify(outputSchema(id, outcomes), null, 2)}\n`,
      'validate-input.mjs': inputValidator,
      'validate-output.mjs': outputValidator,
      ...generatedDocs
    };
    if (write) for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
    changed.push({ id, outcomes, job });
  }
}

process.stdout.write(`${JSON.stringify({ write, changedCount: changed.length, changed }, null, 2)}\n`);
if (!write && changed.length > 0) process.exitCode = 1;
