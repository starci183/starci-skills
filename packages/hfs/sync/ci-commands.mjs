import fs from 'node:fs';
import { parseYaml } from '../runtime/engine/yaml.mjs';
import { refusal } from '../stack/errors.mjs';
import { byCodeUnit } from '../report/order.mjs';

// One command vocabulary for managed CI rendering and the runtime coverage gate.
const exampleCommand = (source, command) => source?.runtimeExample
  ? 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ' + command
  : command;

const UPLOAD_ARTIFACT = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2';
const DOWNLOAD_ARTIFACT = 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0';
const SONAR_CONDITION = "${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') }}";

/** Codecov uploads on release tags with its required authentication; a missing report, an unavailable endpoint or a rejected upload fails the job. */
function codecovSteps(lcovReport, codecov) {
  if (codecov.enabled === false || codecov.wiring === 'not-used') return [
    '      - name: coverage upload',
    '        run: echo "codecov disabled in .starcistacks/application-stacks.yaml"',
  ].join('\n');
  return [
    '      - name: coverage upload',
    '        uses: codecov/codecov-action@0fb7174895f61a3b6b78fc075e0cd60383518dac # v5.5.5',
    "        if: ${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') }}",
    '        with:',
    codecov.auth === 'token' ? `          token: \${{ secrets.${codecov.token} }}` : '          use_oidc: true',
    `          files: ${lcovReport}`,
    '          disable_search: true',
    '          fail_ci_if_error: true',
  ].join('\n');
}

/** Sonar is required: on release tags it consumes the test coverage and lint artifacts, and a missing token fails the job with a clear refusal. */
function sonarJob(sonar, lcovReport, lcovArtifact, nodeMajor, timeout) {
  if (!sonar) return '';
  const condition = SONAR_CONDITION;
  const host = sonar.provider === 'sonarcloud' ? 'https://sonarcloud.io' : `\${{ vars.${sonar.hostVar} }}`;
  const header = [
    '  sonar:',
    '    needs: [lint, coverage]',
    `    timeout-minutes: ${timeout}`,
    '    runs-on: ubuntu-latest',
    '    env:',
    `      SONAR_TOKEN: \${{ secrets.${sonar.token} }}`,
    `      SONAR_HOST_URL: ${host}`,
    '    steps:',
  ].join('\n');
  const steps = [
    '      - name: Sonar token',
    `        if: ${condition}`,
    '        run: |',
    `          if [ -z "$SONAR_TOKEN" ]; then echo "::error::SONAR_TOKEN is not set: Sonar is required, so a missing token fails this job (secret ${sonar.token})"; exit 1; fi`,
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${condition}`,
    '        with:',
    `          name: ${lcovArtifact}`,
    `          path: ${lcovReport.split('/').slice(0, -1).join('/') || '.'}`,
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${condition}`,
    '        with:',
    '          pattern: sonar-lint-*',
    '          path: reports',
    '          merge-multiple: true',
    ...sonarMergeSteps(condition),
    '      - uses: SonarSource/sonarqube-scan-action@c7ee0f9df90b7aa20e8dcf9695dcfe2e7da5b4f2 # v7.2.1',
    `        if: ${condition}`,
    '      - uses: SonarSource/sonarqube-quality-gate-action@7a5fffe8e523c40e0c740b6bc2712ab503e52efa # v1.2.1',
    `        if: ${condition}`,
    '        timeout-minutes: 10',
  ].join('\n');
  // Variable strings are inserted after render() expands partials, so resolve Sonar's shared install partial before insertion.
  const read = name => fs.readFileSync(new URL('../templates/app/ci-workflows/' + name, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  return read('sonar-steps.yml')
    .replace('{{> app/ci-workflows/install-steps.yml}}', () => read('install-steps.yml').trimEnd())
    .replaceAll('{{nodeMajor}}', nodeMajor)
    .replace('{{sonarJobHeader}}', () => header)
    .replace('{{sonarJobSteps}}', () => steps)
    .trimEnd() + '\n';
}

/** The app source reader is be-relative; the authored manifest lives one directory above that side. */
function buildDeclaration(source) {
  if (!source?.read) return {};
  try {
    return parseYaml(source.read('../.starcistacks/application-stacks.yaml')) ?? {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/** Static CI values are strings with valid environment names; expressions cannot turn public config into runtime secret reads. */
function mergeBuildValues(values, entries) {
  for (const [key, value] of Object.entries(entries ?? {})) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(key) || typeof value !== 'string' || value.includes('${{')) {
      throw refusal('STACK_BUILD_ARG_INVALID', 'CI build values must map environment names to literal strings');
    }
    if (values.has(key) && values.get(key) !== value) {
      throw refusal('STACK_BUILD_ARG_INVALID', 'CI build values disagree for ' + key);
    }
    values.set(key, value);
  }
}

/** Image values own their keys; the build-fe gate supplies only missing keys, and sealed members stay unopened. */
function imageBuildEnv(image, gates) {
  const values = new Map();
  mergeBuildValues(values, image?.buildArgs?.values);
  const fallback = new Map();
  for (const gate of gates.filter(entry => entry.name === 'build-fe')) mergeBuildValues(fallback, gate.env);
  for (const [key, value] of fallback) if (!values.has(key)) values.set(key, value);
  if (!values.size) return '';
  return ['        env:', ...[...values.keys()].sort(byCodeUnit).map(key => '          ' + key + ': ' + JSON.stringify(values.get(key)))].join('\n');
}

/** Multiple deployed front ends build separately through the installed turbo (a run step has no node_modules/.bin on PATH), so each fe/apps/<app> and its dependencies see its own public values. */
function frontendBuild(source, app) {
  const declaration = buildDeclaration(source);
  const environments = Object.keys(source?.stack?.imageEnvironments ?? {});
  const environment = environments.length > 1 ? 'production' : environments[0];
  const images = Object.values(declaration.environments?.[environment]?.deploy?.images ?? {});
  const frontend = images.filter(image => app?.sides.fe.apps.some(entry => entry.name === image.app));
  const gates = declaration.release?.gates ?? [];
  const singleEnv = imageBuildEnv(frontend[0], gates);
  if (frontend.length <= 1) return { env: singleEnv, steps: ['      - name: build fe', '        run: npm run build:fe', singleEnv].filter(Boolean).join('\n') };
  const steps = frontend.map(image => [
    '      - name: build fe ' + image.app,
    '        run: npm run codegen --silent && npx --no-install turbo run build --filter=./fe/apps/' + image.app,
    imageBuildEnv(image, gates),
  ].filter(Boolean).join('\n')).join('\n');
  return { env: singleEnv, steps };
}

/** The per-side lint reports (one artifact per lint matrix side) join into the one reports/lint.sonar.json the Sonar import reads, even when one side wrote none. The local release gate writes the same file with mergeSonarReports (release/lint-report.mjs): keep both identical. */
function sonarMergeSteps(condition) {
  return [
    '      - name: merge Sonar lint reports',
    `        if: ${condition}`,
    '        run: |',
    "          node --input-type=module <<'NODE'",
    "          import fs from 'node:fs';",
    "          const files = ['reports/lint.be.sonar.json', 'reports/lint.fe.sonar.json'];",
    "          const reports = files.filter(file => fs.existsSync(file)).map(file => JSON.parse(fs.readFileSync(file, 'utf8')));",
    '          const rules = [...new Map(reports.flatMap(report => report.rules).map(rule => [rule.id, rule])).values()];',
    '          const issues = reports.flatMap(report => report.issues);',
    "          fs.mkdirSync('reports', { recursive: true });",
    "          fs.writeFileSync('reports/lint.sonar.json', JSON.stringify({ rules, issues }, null, 2) + '\\n');",
    '          NODE',
  ];
}

const STANDARD = new URL('../runtime/knowledge/hfs/ci-standard.yaml', import.meta.url);
/** jest --shard=i/N gives each shard ceil(specs / N) spec files in order, so shard N is empty unless (N - 1) * ceil(specs / N) < specs. */
export function filledShards(specs, wanted) {
  for (let shards = wanted; shards > 1; shards -= 1) if ((shards - 1) * Math.ceil(specs / shards) < specs) return shards;
  return 1;
}

/** The unit specs of the be source: every *.spec.ts outside the test kind folders (src/tests/<kind>), the files the unit project runs. */
const unitSpecCount = (source) => (source?.files ?? []).filter((file) => file.endsWith('.spec.ts') && !file.includes('/tests/')).length;

/** The per-job settings of the managed CI: ci.jobs.<job>.timeoutMinutes and ci.jobs.test.shards of the manifest over the defaults of the CI standard, the shards capped at the count the unit specs fill (an empty shard would fail, never pass empty). */
function ciJobSettings(declaration, source) {
  const { defaults, heap } = parseYaml(fs.readFileSync(STANDARD, 'utf8'));
  const jobs = declaration?.ci?.jobs ?? {};
  const timeout = (job) => String(jobs[job]?.timeoutMinutes ?? defaults.timeoutMinutes[job]);
  const wanted = Number(jobs.test?.shards ?? defaults.shards);
  const shards = source?.files?.length ? filledShards(unitSpecCount(source), wanted) : wanted;
  return {
    nodeOptions: `--max-old-space-size=${heap.minMiB}`,
    timeoutFast: timeout('fast'), timeoutLint: timeout('lint'), timeoutTest: timeout('test'), timeoutCoverage: timeout('coverage'),
    timeoutBuild: timeout('build'), timeoutSonar: timeout('sonar'), timeoutDbTypes: timeout('db-types'),
    testShards: `[${Array.from({ length: shards }, (_, index) => index + 1).join(', ')}]`, testShardTotal: String(shards),
  };
}

/** An omitted quality declaration preserves hosted Sonar, required OIDC Codecov, and the high production dependency audit. */
export function ciWorkflowCommands(source, lcovReport = 'be/coverage/lcov.info', quality = undefined, { nodeMajor = '22', app } = {}) {
  const configuredSonar = quality === undefined ? { token: 'SONAR_TOKEN', hostVar: 'SONAR_HOST_URL' } : quality.sonar;
  const sonar = configuredSonar?.wiring === 'not-used' || configuredSonar?.mode === 'disabled' ? null : configuredSonar;
  const codecov = quality?.codecov ?? { enabled: true, auth: 'oidc' };
  const audit = quality?.audit ?? { level: 'high', omitDev: true };
  const lcovArtifact = 'coverage-lcov';
  const build = frontendBuild(source, app);
  const settings = ciJobSettings(buildDeclaration(source), source);
  const side = '${{ matrix.side }}';
  return {
    ...settings,
    lcovShardsDir: lcovReport.split('/').slice(0, -1).concat('shards').join('/'),
    // The istanbul JSON a shard writes beside the lcov (STARCI_COVERAGE_SHARD=1): what the coverage job merges.
    shardCoverageReport: lcovReport.split('/').slice(0, -1).concat('coverage-final.json').join('/'),
    ciBuildEnv: build.env,
    ciBuildSteps: build.steps,
    ciLint: exampleCommand(source, 'npm run lint'),
    ciLintSonar: exampleCommand(source, 'npm run lint -- --sonar reports/lint.sonar.json'),
    // The coverage judgement alone over the merged report: the fast and lint jobs already ran every other rule of the app check.
    ciCoverageProof: exampleCommand(source, 'npx starci app coverage verify ' + lcovReport),
    ciDatabaseLint: exampleCommand(source, 'npm run db:lint'),
    auditCommand: `npm audit${audit.omitDev ? ' --omit=dev' : ''} --audit-level=${audit.level}`,
    sonarTokenSecret: sonar?.token ?? 'SONAR_TOKEN',
    sonarHostVar: sonar?.hostVar ?? 'SONAR_HOST_URL',
    // One lint job per side (the lint matrix): with Sonar each side writes its own report, uploaded as sonar-lint-<side> and merged by the sonar job.
    ciLintSteps: (sonar ? [
      '      - name: lint with Sonar import',
      `        run: ${exampleCommand(source, 'npm run lint -- --side ' + side + ' --sonar reports/lint.' + side + '.sonar.json')}`,
      '        env:',
      `          NODE_OPTIONS: ${settings.nodeOptions}`,
      `      - uses: ${UPLOAD_ARTIFACT}`,
      // Inside an if: expression the matrix value is an argument of format(), never a nested ${{ }} (actionlint: a nested expression makes the condition always true).
      "        if: always() && hashFiles(format('reports/lint.{0}.sonar.json', matrix.side)) != ''",
      '        with:',
      `          name: sonar-lint-${side}`,
      `          path: reports/lint.${side}.sonar.json`,
    ] : [
      '      - name: lint',
      `        run: ${exampleCommand(source, 'npm run lint -- --side ' + side)}`,
      '        env:',
      `          NODE_OPTIONS: ${settings.nodeOptions}`,
    ]).join('\n'),
    codecovSteps: codecovSteps(lcovReport, codecov),
    sonarJob: sonarJob(sonar, lcovReport, lcovArtifact, nodeMajor, settings.timeoutSonar),
    lcovArtifact,
  };
}
