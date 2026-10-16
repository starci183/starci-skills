// proves: ARCH_GRAMMAR_CONTRACT_INVALID@lite
// proves: ARCH_GRAMMAR_CONTRACT_INVALID@full
// proves: ARCH_GRAMMAR_EXPORT_BYPASS@lite
// proves: ARCH_GRAMMAR_EXPORT_BYPASS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { projectFixture } from '../../packages/eslint/be/fixtures/project/tester.mjs';
import { rules } from '../../packages/eslint/fe/project-graph.mjs';
import { checkArchitecture } from '../../scripts/hfs/architecture/index.mjs';
import { checkGrammar } from '../../scripts/hfs/architecture/frontend-grammar.mjs';
import { loadArchitectureConfig } from '../../scripts/hfs/architecture/config.mjs';
import { buildTypeScriptContext, relativePath } from '../../scripts/hfs/architecture/typescript.mjs';
import { LINT_ENFORCERS } from '../../scripts/hfs/architecture/surface.mjs';

const ts = createRequire(import.meta.url)('typescript');
const entry = 'apps/web/src/app/page.tsx';
const source = 'import { Button } from "@starci/grammar/common"; export default function Route() { return <Button /> }';
const bypassEntry = 'apps/web/src/app/bypass.tsx';
const bypassSource = 'import { Button } from "@starci/grammar/private"; export const Bypass = () => <Button />;';
const peers = { react: '>=18', '@heroui/react': '>=2', '@xyflow/react': '>=12' };

function fixture(t, edition, invalid = false, bypass = false) {
  const exports = { './common': { types: './dist/common/index.d.ts', import: './dist/common/index.js' } };
  if (!invalid) exports['./common.css'] = './dist/common/styles.css';
  const result = projectFixture({
    profile: 'fe', edition,
    rootFiles: {
      'package.json': JSON.stringify({ name: 'fixture', private: true, dependencies: {
        '@starci/grammar': '0.4.11', react: '19.0.0', '@heroui/react': '2.0.0', '@xyflow/react': '12.11.6',
      } }),
      'node_modules/@starci/grammar/package.json': JSON.stringify({ name: '@starci/grammar', version: '0.4.11', peerDependencies: peers, exports }),
      'node_modules/@starci/grammar/dist/common/index.js': 'export const Button = () => null;',
      'node_modules/@starci/grammar/dist/common/index.d.ts': 'export declare const Button: () => null;',
      'node_modules/@starci/grammar/dist/common/styles.css': ':root{}',
    },
    files: {
      [entry]: source,
      ...(bypass ? { [bypassEntry]: bypassSource } : {}),
      'apps/web/src/app/globals.css': '@import "@starci/grammar/common.css";',
    },
  });
  t.after(result.cleanup);
  return result;
}

function grammarFindings(root) {
  const config = loadArchitectureConfig(root);
  return checkGrammar(config, buildTypeScriptContext(config, ts, []), (owner, file, node, ruleId, message, extra) => ({
    ruleId, path: relativePath(owner.root, file.fileName), line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    message, ...extra,
  }));
}

for (const edition of ['lite', 'full']) {
  test(`${edition} invalid package contracts remain app-check findings and never TSX lint reports`, t => {
    const app = fixture(t, edition, true);
    const findings = grammarFindings(app.root);
    assert.ok(findings.some(hit => hit.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID'));
    const checked = checkArchitecture({ repositoryRoot: app.root, injectedTypeScript: ts, surface: 'check' });
    const contracts = checked.violations.filter(hit => hit.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID');
    assert.equal(contracts.length, 1);
    assert.match(contracts[0].path, /(?:^|\/)package\.json$/);
    assert.match(contracts[0].message, /common\.css is not a safe declared style export/);
    const linted = checkArchitecture({ repositoryRoot: app.root, injectedTypeScript: ts, surface: 'lint' });
    assert.deepEqual(linted.violations.filter(hit => hit.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID'), []);
    assert.deepEqual(LINT_ENFORCERS.find(enforcer => enforcer.id === 'grammar-entry').codes, ['ARCH_GRAMMAR_EXPORT_BYPASS']);
    app.tester.run('grammar-entry', rules['grammar-entry'], {
      valid: [{ filename: app.at(entry), code: source }], invalid: [],
    });
  });

  test(`${edition} valid package contracts pass the machine, app check and TSX lint`, t => {
    const app = fixture(t, edition);
    assert.deepEqual(grammarFindings(app.root), []);
    const checked = checkArchitecture({ repositoryRoot: app.root, injectedTypeScript: ts, surface: 'check' });
    assert.deepEqual(checked.violations.filter(hit => hit.ruleId === 'ARCH_GRAMMAR_CONTRACT_INVALID'), []);
    app.tester.run('grammar-entry', rules['grammar-entry'], {
      valid: [{ filename: app.at(entry), code: source }], invalid: [],
    });
  });

  test(`${edition} invalid grammar imports are rejected by the machine and TSX lint`, t => {
    const app = fixture(t, edition, false, true);
    assert.ok(grammarFindings(app.root).some(hit => hit.ruleId === 'ARCH_GRAMMAR_EXPORT_BYPASS'));
    app.tester.run('grammar-entry', rules['grammar-entry'], {
      valid: [{ filename: app.at(entry), code: source }],
      invalid: [{ filename: app.at(bypassEntry), code: bypassSource, errors: [{ message: /ARCH_GRAMMAR_EXPORT_BYPASS/ }] }],
    });
  });
}
