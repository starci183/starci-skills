// proves: BE_CLI_REQUIRED@lite
// proves: BE_CLI_REQUIRED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { cliFindings } from '../runtime/scripts/hfs/rules/cli.mjs';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();
const API = { name: 'api', kind: 'api' };
const CLI = { name: 'cli', kind: 'cli' };
const COMMAND = 'be/src/features/cli/migrate/subs/run.cli.ts';
const IMAGE = 'be/apps/cli/Dockerfile';
const PRIMARY = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'api', isolation: 'database' }];

function input(edition, apps, files, connections = []) {
    const repo = resolveRepoDeclaration(manifest, {
        hfs: 3,
        kind: 'app',
        project: 'cli-proof',
        edition,
        sides: {
            be: { apps, connections },
            fe: { apps: [{ name: 'web', kind: 'next' }] },
        },
    });
    assert.equal(repo.edition, edition);
    return { repo, files, resolver: createSlotResolver(manifest, repo) };
}

for (const edition of ['lite', 'full']) {
    test(`${edition} valid CLI app and image pass for tracked commands`, () => {
        assert.deepEqual(cliFindings(input(edition, [API, CLI], [COMMAND, IMAGE])), []);
        assert.deepEqual(cliFindings(input(edition, [API], [])), []);
    });

    test(`${edition} missing CLI app for tracked commands is invalid`, () => {
        assert.deepEqual(cliFindings(input(edition, [API], [COMMAND])).map((finding) => finding.code), ['BE_CLI_REQUIRED']);
    });

    test(`${edition} invalid CLI name and missing CLI image are rejected`, () => {
        const renamed = cliFindings(input(edition, [API, { name: 'ops', kind: 'cli' }], [COMMAND]));
        assert.deepEqual(renamed.map((finding) => finding.code), ['BE_CLI_REQUIRED']);
        assert.equal(renamed[0].app, 'ops');
        const imageless = cliFindings(input(edition, [API, CLI], [COMMAND]));
        assert.deepEqual(imageless.map((finding) => finding.code), ['BE_CLI_REQUIRED']);
        assert.equal(imageless[0].path, IMAGE);
    });

    test(`${edition} connection-only requirements follow the actual edition slot`, () => {
        const findings = cliFindings(input(edition, [API], [], PRIMARY));
        const expected = edition === 'full' ? ['BE_CLI_REQUIRED'] : [];
        assert.deepEqual(findings.map((finding) => finding.code), expected);
    });
}
