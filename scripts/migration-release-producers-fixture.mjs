// Synthetic completed producers for the migration release integration tests, never live receipts.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateWorkspaceStep } from '../operators/workspace-bind/validate.mjs';
import { validateQualityStep, SCORECARD_TOPICS } from '../operators/quality-verify/validate.mjs';

const digest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const table = (heading, columns, rows = []) => `${heading}\n\n| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map((row) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
const code = (value) => '`' + value + '`';
const write = (base, relative, value) => {
  const file = path.join(base, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
  return file;
};

export async function writeMigrationReleaseProducers({ root, session, checkout, head, backendRef }) {
  const state = JSON.parse(fs.readFileSync(path.join(session, 'state.json'), 'utf8'));
  const project = state.project, sessionId = state.id, branchName = `session/${sessionId}`;
  const disk = path.resolve(checkout).replaceAll('\\', '/');
  const routeBranch = path.join(session, 'step-2/parallel-1');
  const qualityBranch = path.join(session, 'step-3/parallel-1');
  const route = {
    project, role: 'be', portableRouteRef: `.workspaces/projects/${project}/be.json`,
    hydratedRouteRef: `.workspaces/local/routes/${project}/be/config.json`,
    routeFingerprint: digest('synthetic portable and hydrated route'), identityFingerprint: digest('synthetic sealed roster'),
    sourceHead: head,
    checkout: { diskPath: disk, gitRoot: disk, gitRepository: 'https://example.invalid/migration-fixture.git',
      branch: branchName, repositoryKind: 'source', directory: null, sourceHead: head },
    gitPolicy: { worktreeBranches: 'session-only', mutationBranch: 'main' },
    mutationReadiness: 'ready', writeRoots: [], authorityRoots: { businesses: null }, runtime: null, provenanceHeadRef: null,
  };
  const routeRequest = { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1, sessionId,
    contexts: [{ alias: `@workspaces/projects/${project}/be`, head: null }, { alias: `@workspaces/local/routes/${project}/be`, head }, { alias: '@workspaces/device-state', head: null }],
    requirements: { project, role: 'be', gitPolicy: route.gitPolicy, declaredWriteRoots: [], resume: null },
    inputs: {}, resume: null };
  const routeRequestFile = write(routeBranch, 'request/request.json', routeRequest);
  write(routeBranch, 'response/data/route.json', route);
  write(routeBranch, 'response/response.json', { schemaVersion: 9, operatorId: 'workspace.bind', step: 2, parallel: 1,
    status: 'done', fallbacks: [], commits: [], next: [],
    fields: { 'workspace-route-binding': 'response/response.md', route: 'response/data/route.json' } });
  write(routeBranch, 'response/response.md', `# workspace-route-binding — ${project}/be\n\nSynthetic source binding for the migration release regression.\n\n`
    + table('## Binding', ['Field', 'Value'], [['Project', project], ['Role', 'be'], ['Portable route', route.portableRouteRef], ['Hydrated route', route.hydratedRouteRef], ['Source head', head]])
    + table('## Checkout', ['Field', 'Value'], [['Disk path', disk], ['Git root', disk], ['Git repository', route.checkout.gitRepository], ['Branch', branchName], ['Repository kind', 'source'], ['Directory', '—'], ['Source head', head], ['Mutation readiness', 'ready'], ['Businesses root', '—']])
    + table('## Policy', ['Field', 'Value'], [['Worktree branches', 'session-only'], ['Mutation branch', 'main']])
    + table('## Write roots', ['Path', 'Why']) + table('## Runtime', ['Field', 'Value'])
    + table('## Findings', ['Code', 'Subject', 'Statement'], [
      [code('ROUTE_HYDRATED_FROM_PORTABLE'), route.hydratedRouteRef, 'the synthetic portable declaration resolves this test checkout'],
      [code('IDENTITY_ROSTER_SEALED'), 'fixture-roster', 'the synthetic roster is named only'],
      [code('WORKTREE_BRANCH_SESSION_ONLY'), 'main', 'the test checkout is on the declared session branch'],
    ]));

  const gate = { gate: 'integration', commandRef: 'package.json#scripts.test', configRef: 'package.json', required: true };
  const qualityRequest = { schemaVersion: 9, operatorId: 'quality.verify', step: 3, parallel: 1, sessionId,
    contexts: [{ alias: '@workspaces/be', head }], requirements: { gates: [gate], explicitE2eRequest: false, sonarScope: 'new-code', declaredDebts: [], resume: null },
    inputs: { 'backend-source-application': backendRef }, resume: null };
  const qualityRequestFile = write(qualityBranch, 'request/request.json', qualityRequest);
  write(qualityBranch, 'response/response.json', { schemaVersion: 9, operatorId: 'quality.verify', step: 3, parallel: 1,
    status: 'done', fallbacks: [], commits: [], next: [],
    fields: { 'quality-verification': 'response/response.md', 'gate-result': ['response/data/gates/integration.json'] } });
  write(qualityBranch, 'response/data/gates/integration.json', { ...gate, sourceHead: head, predecessorCommit: head,
    sessionBranch: branchName, observedAt: '2026-09-04T00:00:00.000Z', status: 'pass', exitCode: 0,
    evidenceRef: 'gates/integration.log', classification: null, sonarScope: null, debt: null,
    statement: 'Synthetic passing gate at the fixture commit; not a product test result.' });
  write(qualityBranch, 'response/gates/integration.log', 'Synthetic fixture gate passed.\n');
  write(qualityBranch, 'response/response.md', `# quality-verification — ${head}\n\nSynthetic backend verification; UI topics were not observed.\n\n`
    + table('## Binding', ['Field', 'Value'], [['Operator', code('quality.verify')], ['Step', code('step-3/parallel-1')], ['Checkout', code('@workspaces/be')], ['Head', code(head)], ['Session branch', code(branchName)], ['Predecessors', code(backendRef)]])
    + table('## Gate plan', ['Gate', 'Required', 'Command', 'Configuration'], [[code(gate.gate), 'yes', code(gate.commandRef), code(gate.configRef)]])
    + table('## Results', ['Gate', 'Status', 'Exit code', 'Evidence', 'Classification', 'Statement'], [[code(gate.gate), 'pass', '0', code('gates/integration.log'), '—', 'synthetic gate passed']])
    + table('## Coverage', ['Metric', 'Measured', 'Threshold', 'Verdict'])
    + table('## Sonar', ['Field', 'Value'], [['Scope', 'new-code'], ['Finding', '—']])
    + table('## Debts', ['Debt', 'Gate', 'Approval', 'Owner', 'Expires', 'Statement'])
    + table('## Findings', ['Code', 'Gate', 'Statement'], [[code('PREDECESSOR_CONSUMED'), '—', 'the backend fixture receipt was consumed']])
    + table('## Gate verdict', ['Field', 'Value'], [['Verdict', code('pass')]])
    + table('## Verdict', ['Topic', 'Verdict', 'Route'], SCORECARD_TOPICS.map((topic) => [code(topic), 'blocked', 'none']))
    + 'Verdict: blocked\n\n'
    + table('## Audit scope', ['Field', 'Value'], [['Mode', 'not-recorded'], ['Coverage claim', 'not-recorded'], ['Deferred states', '—']]));
  const routeCheck = await validateWorkspaceStep(routeBranch, root);
  const qualityCheck = await validateQualityStep(qualityBranch, root);
  if (routeCheck.errors.length || qualityCheck.errors.length) throw new Error([...routeCheck.errors, ...qualityCheck.errors].join('\n'));
  return { routeRef: 'step-2/parallel-1/response/data/route.json', qualityRef: 'step-3/parallel-1/response/response.md',
    requestFiles: [routeRequestFile, qualityRequestFile],
    requestHashes: { '2/1': digest(fs.readFileSync(routeRequestFile)), '3/1': digest(fs.readFileSync(qualityRequestFile)) } };
}
