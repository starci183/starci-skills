#!/usr/bin/env node
'use strict';

/**
 * `npm run test:e2e -- <selector>`
 *
 * Selector forms, both of which name a frozen assertion set from test/e2e/lib/registry.js:
 *   <group>             e.g. auth/sign-in, tasks/create, audit/erasure-complete   (the form the fr
 *                       records' requiresProof.e2e.command actually names)
 *   <group>#<assertion> runs one assertion of that group, for replaying a single evidence line
 *   --list              prints the frozen assertion set and exits without any effect at all
 *
 * What this does, in order: allocate loopback ports, bring up a run-owned docker compose project
 * (postgres + keycloak + redis, named and volume-scoped to this run), start the api as a child process
 * of this run pointed only at those services, run the selected scenarios against it as real HTTP, then
 * dispose every container, volume and process it created and verify by observation that they are gone.
 *
 * It never attaches to a stack it did not start. There is no env var that points this suite at an
 * already-running api: lib/client.js refuses to run without E2E_API_URL, and E2E_API_URL is only ever
 * set by this file, to the port this file allocated.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { runToken } = require('./lib/ports');
const stack = require('./lib/stack');
const journal = require('./lib/journal');
const { GROUPS, groupNames, groupAssertions } = require('./lib/registry');

const slug = (group) => group.replace(/\//g, '-');
const SPEC_SUFFIX = '.e2e-spec.js';

function parseArgs(argv) {
  const args = { selector: null, journalDir: null, list: false, keepStack: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--list') args.list = true;
    else if (token === '--journal') args.journalDir = argv[++i];
    else if (token === '--keep-stack') args.keepStack = true;
    else if (token.startsWith('-')) throw new Error(`unknown flag ${token}`);
    else if (!args.selector) args.selector = token;
    else throw new Error(`only one selector is accepted, saw ${token} as well`);
  }
  return args;
}

function jestBin() {
  for (const candidate of ['jest/bin/jest.js', 'jest/bin/jest']) {
    try {
      return require.resolve(candidate, { paths: [stack.BACKEND_ROOT] });
    } catch {
      /* try the next spelling */
    }
  }
  throw new Error('jest is not installed under examples/todo-app-backend/node_modules - run `npm install` there first');
}

function runJest({ specArg, titleFilter, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      jestBin(),
      '--config', path.join(__dirname, 'jest.config.js'),
      '--colors=false',
      ...(titleFilter ? ['-t', titleFilter] : []),
      '--runTestsByPath', specArg,
    ], { cwd: stack.BACKEND_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });

    let output = '';
    const write = (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    };
    child.stdout.on('data', write);
    child.stderr.on('data', write);
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function summary(readback) {
  const counts = { pass: 0, fail: 0, 'not-run': 0 };
  for (const entry of readback) counts[entry.outcome] = (counts[entry.outcome] ?? 0) + 1;
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const group of groupNames()) {
      console.log(`\n${group}   (${GROUPS[group].record})   ${GROUPS[group].command}`);
      for (const assertion of groupAssertions(group)) {
        const flag = assertion.notRun ? ' [NOT-RUN: no public proof surface]' : '';
        console.log(`  ${assertion.id}${flag}`);
      }
    }
    const total = groupNames().reduce((sum, group) => sum + groupAssertions(group).length, 0);
    console.log(`\n${groupNames().length} groups, ${total} assertions, one scenario each.`);
    return 0;
  }

  if (!args.selector) {
    console.error('usage: npm run test:e2e -- <group>[#<assertion-id>]   (see --list for the frozen set)');
    return 2;
  }
  const [group, assertionId] = args.selector.split('#');
  if (!GROUPS[group]) {
    console.error(`unknown selector "${args.selector}".\ngroups: ${groupNames().join(', ')}`);
    return 2;
  }
  const assertions = groupAssertions(group);
  if (assertionId && !assertions.some((assertion) => assertion.id === assertionId)) {
    console.error(`"${assertionId}" is not an assertion of ${group}.\nassertions: ${assertions.map((a) => a.id).join(', ')}`);
    return 2;
  }

  const token = runToken(5);
  // Where the journal for this run goes. The default is a fresh temp directory per run; pointing it
  // somewhere else with E2E_JOURNAL_DIR only chooses where the same bytes land, it changes no selection.
  const journalDir = path.resolve(args.journalDir ?? process.env.E2E_JOURNAL_DIR ?? path.join(os.tmpdir(), 'todo-app-e2e', `${slug(group)}-${token}`));
  process.env.E2E_JOURNAL_DIR = journalDir;
  fs.mkdirSync(journalDir, { recursive: true });
  const startedAt = new Date();

  console.log(`e2e: selector ${args.selector}`);
  console.log(`e2e: journal ${journalDir}`);
  console.log(`e2e: bringing up the run-owned stack (this suite starts it; it never attaches to one it did not)`);

  let started = null;
  let api = null;
  let bootFailure = null;
  let specFile = null;
  let result = { code: 1, output: '' };
  let readback = [];
  let teardown = null;
  let coverageGap = null;
  let services = null;
  let postgresSchema = null;

  // The compose project exists the moment startServices returns, so everything from there to the end of
  // the scenario run is inside one try whose finally disposes it: a boot failure, a timed-out readiness
  // wait or a throw while building the environment can no longer leave the stack running.
  try {
    started = await stack.startServices();
    console.log(`e2e: compose project ${started.project} up - postgres :${started.pgPort}, keycloak :${started.kcPort}, redis :${started.redisPort}`);
    api = stack.startApi(started);
    const readiness = await stack.waitForApi(api);
    console.log(`e2e: api serving ${api.baseUrl} after ${readiness.waitedMs}ms`);
    // Captured while the stack is still up: after disposal `docker compose ps` would report nothing.
    services = stack.serviceIdentities(started);
    postgresSchema = stack.postgresSchemaAfterBoot(started);

    const env = {
      ...process.env,
      E2E_API_URL: api.baseUrl,
      E2E_JOURNAL_DIR: journalDir,
      E2E_RUN_TOKEN: token,
      E2E_COMPOSE_PROJECT: started.project,
    };

    specFile = path.join(__dirname, 'scenarios', `${slug(group)}${SPEC_SUFFIX}`);
    if (!fs.existsSync(specFile)) {
      console.error(`e2e: no spec file for group ${group} at ${specFile}`);
      return 1;
    }
    // Relative to rootDir, forward slashes: an absolute Windows path is a regex full of backslash
    // escapes and jest matches nothing with it.
    const specArg = path.relative(stack.BACKEND_ROOT, specFile).replace(/\\/g, '/');

    try {
      result = await runJest({ specArg, titleFilter: assertionId ?? null, env });
      readback = journal.readJsonl('readback.jsonl');
      // A run that quietly matched no test is not a green run. Every assertion this selector names must
      // have written its own readback line, or the command fails with the missing ids named.
      const expected = assertionId ? [assertionId] : assertions.map((assertion) => assertion.id);
      const observed = new Set(readback.map((entry) => entry.assertionId));
      const missing = expected.filter((id) => !observed.has(id));
      if (missing.length) {
        coverageGap = `no readback recorded for ${missing.join(', ')}`;
        result.code = result.code === 0 ? 1 : result.code;
      }
    } finally {
      // Disposal itself is the outer finally's job; this one only records the requested exception to it.
      if (args.keepStack) {
        console.log(`e2e: --keep-stack set, leaving ${started.project} running for inspection`);
        teardown = { skipped: true, project: started.project };
      }
    }
  } catch (error) {
    console.error(`e2e: run failed - ${error?.message ?? error}`);
    bootFailure = error ?? new Error('the run failed without an error object');
  } finally {
    if (started && !args.keepStack && !teardown) teardown = await stack.stopAll(started, api);
  }

  if (bootFailure) {
    // No scenario ran, so the assertion-set records would be a fiction. The journal gets the stack that
    // was really up and the reason the run stopped at boot.
    if (started) {
      journal.writeJson('stack.json', {
        selector: args.selector,
        group,
        record: GROUPS[group].record,
        command: GROUPS[group].command,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        composeProject: started.project,
        ports: { postgres: started.pgPort, keycloak: started.kcPort, redis: started.redisPort, api: started.apiPort },
        observedIdentity: started.identity,
        bootFailure: bootFailure.message ?? String(bootFailure),
        teardown,
      });
    }
    process.exitCode = 1;
    return 1;
  }

  const git = require('node:child_process').spawnSync('git', ['rev-parse', 'HEAD'], { cwd: stack.BACKEND_ROOT, encoding: 'utf8' });
  const dirty = require('node:child_process').spawnSync('git', ['status', '--porcelain', '--', 'examples/todo-app-backend'], {
    cwd: path.resolve(stack.BACKEND_ROOT, '..', '..'), encoding: 'utf8',
  });

  journal.writeJson('scenarios.json', {
    group,
    record: GROUPS[group].record,
    command: GROUPS[group].command,
    selector: args.selector,
    specFile: path.relative(stack.BACKEND_ROOT, specFile).replace(/\\/g, '/'),
    assertions: assertions.map((assertion) => ({
      id: assertion.id,
      scenario: assertion.id,
      statement: assertion.statement,
      clientRequest: assertion.request,
      expectedObservableEffect: assertion.expect,
      unprovenClauses: assertion.unproven ?? [],
      notRunReason: assertion.notRun ?? null,
      observedOutcome: readback.find((entry) => entry.assertionId === assertion.id)?.outcome ?? 'missing',
    })),
  });

  journal.writeJson('readback.json', readback);

  journal.writeJson('stack.json', {
    selector: args.selector,
    group,
    record: GROUPS[group].record,
    command: GROUPS[group].command,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    composeProject: started.project,
    composeFile: path.relative(stack.BACKEND_ROOT, stack.COMPOSE_FILE).replace(/\\/g, '/'),
    apiProcess: { entry: 'dist/main.js', baseUrl: api.baseUrl, pid: api.child.pid, exitCode: api.child.exitCode, log: 'api.log' },
    services,
    observedIdentity: { ...started.identity, postgresSchemaAfterApiBoot: postgresSchema },
    ports: { postgres: started.pgPort, keycloak: started.kcPort, redis: started.redisPort, api: started.apiPort },
    testedTree: {
      head: git.stdout?.trim() || 'unknown',
      dirtyExamplePaths: (dirty.stdout ?? '').trim().split('\n').filter(Boolean),
    },
    teardown,
    counts: summary(readback),
  });

  journal.writeText('run-output.txt', `# npm run test:e2e -- ${args.selector}\n# exit code ${result.code}\n\n${result.output}`);

  console.log('\ne2e: per-assertion outcome');
  for (const assertion of assertions) {
    const observed = readback.find((entry) => entry.assertionId === assertion.id);
    console.log(`  ${(observed?.outcome ?? 'MISSING').padEnd(8)} ${assertion.id}`);
  }
  const counts = summary(readback);
  if (coverageGap) console.log(`e2e: COVERAGE GAP - ${coverageGap}`);
  console.log(`e2e: ${counts.pass ?? 0} pass, ${counts.fail ?? 0} fail, ${counts['not-run'] ?? 0} not-run; stack disposed: ${teardown?.clean === true}`);
  return result.code;
}

main().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(`e2e: run failed - ${error?.stack ?? error}`);
  process.exitCode = 1;
});
