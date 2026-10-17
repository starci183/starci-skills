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
const SONAR_CONDITION = "${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') && env.SONAR_TOKEN != '' }}";

/** Optional uploads require reachable upload and authentication endpoints without exposing identity tokens. */
function codecovProbe(codecov, condition) {
  if (!codecov.optional) return [];
  return [
    '      - name: Codecov availability',
    '        id: codecov-availability',
    `        if: ${condition}`,
    '        env:',
    `          CODECOV_AUTH: ${codecov.auth}`,
    '        run: |',
    "          node --input-type=module <<'NODE'",
    "          import fs from 'node:fs';",
    '          let available = false;',
    '          try {',
    "            const upload = await fetch('https://ingest.codecov.io/upload/v4', { signal: AbortSignal.timeout(10000) });",
    '            available = upload.status < 500;',
    "            if (available && process.env.CODECOV_AUTH === 'oidc') {",
    "              const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);",
    "              url.searchParams.set('audience', 'https://codecov.io');",
    "              const identity = await fetch(url, { headers: { Authorization: 'Bearer ' + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN }, signal: AbortSignal.timeout(10000) });",
    '              available = identity.ok && Boolean((await identity.json()).value);',
    '            }',
    '          } catch { available = false; }',
    "          fs.appendFileSync(process.env.GITHUB_OUTPUT, 'up=' + available + '\\n');",
    "          if (!available) console.log('::notice::codecov upload skipped: upload endpoint or OIDC token unavailable (services.codecov.optional)');",
    '          NODE',
  ];
}

/** Optional Sonar only runs analysis when the provider reports UP within ten seconds. */
function sonarProbe(sonar) {
  if (!sonar.optional) return [];
  return [
    '      - name: Sonar availability',
    '        id: sonar-availability',
    `        if: ${SONAR_CONDITION}`,
    '        run: |',
    `          if curl -fsS --max-time 10 "$SONAR_HOST_URL/api/system/status" | node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{process.exit(JSON.parse(s).status==='UP'?0:1)}catch{process.exit(1)}})"; then`,
    '            echo "up=true" >> "$GITHUB_OUTPUT"',
    '          else',
    '            echo "up=false" >> "$GITHUB_OUTPUT"',
    '            echo "::notice::sonar skipped: $SONAR_HOST_URL not reachable (services.sonar.optional)"',
    '          fi',
  ];
}

/** Codecov reports missing coverage without failing twice; uploads retain the release-tag condition and required authentication. */
function codecovSteps(lcovReport, codecov) {
  if (codecov.enabled === false || codecov.wiring === 'not-used') return [
    '      - name: coverage upload',
    '        run: echo "codecov disabled in .starcistacks/application-stacks.yaml"',
  ].join('\n');
  const condition = `\${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') && hashFiles('${lcovReport}') != '' }}`;
  const uploadCondition = codecov.optional ? condition.replace(' }}', " && steps.codecov-availability.outputs.up == 'true' }}") : condition;
  return [
    '      - name: coverage upload skipped',
    `        if: \${{ !cancelled() && hashFiles('${lcovReport}') == '' }}`,
    '        run: |',
    `          echo "::notice::codecov upload skipped: no coverage file at ${lcovReport} (the test step failed or produced none)"`,
    '          exit 0',
    ...codecovProbe(codecov, condition),
    '      - name: coverage upload',
    ...(codecov.optional ? ['        id: codecov-upload', '        continue-on-error: true'] : []),
    '        uses: codecov/codecov-action@0fb7174895f61a3b6b78fc075e0cd60383518dac # v5.5.5',
    `        if: ${uploadCondition}`,
    '        with:',
    codecov.auth === 'token' ? `          token: \${{ secrets.${codecov.token} }}` : '          use_oidc: true',
    `          files: ${lcovReport}`,
    '          disable_search: true',
    `          fail_ci_if_error: ${!codecov.optional}`,
    ...(codecov.optional ? [
      '      - name: Codecov upload unavailable',
      "        if: ${{ !cancelled() && steps.codecov-upload.outcome == 'failure' }}",
      '        run: |',
      '          echo "::notice::codecov upload skipped: upload unavailable (services.codecov.optional)"',
    ] : []),
  ].join('\n');
}

/** Sonar consumes the test coverage and fast lint artifacts only on release tags with a configured token. */
function sonarJob(sonar, lcovReport, lcovArtifact, nodeMajor) {
  if (!sonar) return '';
  const condition = sonar.optional ? SONAR_CONDITION.replace(' }}', " && steps.sonar-availability.outputs.up == 'true' }}") : SONAR_CONDITION;
  const host = sonar.provider === 'sonarcloud' ? 'https://sonarcloud.io' : `\${{ vars.${sonar.hostVar} }}`;
  const header = [
    '  sonar:',
    '    needs: [fast, test]',
    '    timeout-minutes: 20',
    '    runs-on: ubuntu-latest',
    '    env:',
    `      SONAR_TOKEN: \${{ secrets.${sonar.token} }}`,
    `      SONAR_HOST_URL: ${host}`,
    '    steps:',
  ].join('\n');
  const steps = [
    ...sonarProbe(sonar),
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${condition}`,
    '        with:',
    `          name: ${lcovArtifact}`,
    `          path: ${lcovReport.split('/').slice(0, -1).join('/') || '.'}`,
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${condition}`,
    '        with:',
    '          name: sonar-lint',
    '          path: reports',
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

/** Side lint reports join into the single Sonar artifact even when one side could not write its report. */
function sonarMergeSteps() {
  return [
    '      - name: merge Sonar lint reports',
    "        if: always() && env.SONAR_TOKEN != ''",
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

/** An omitted quality declaration preserves hosted Sonar, required OIDC Codecov, and the high production dependency audit. */
export function ciWorkflowCommands(source, lcovReport = 'be/coverage/lcov.info', quality = undefined, { nodeMajor = '22', app } = {}) {
  const configuredSonar = quality === undefined ? { token: 'SONAR_TOKEN', hostVar: 'SONAR_HOST_URL' } : quality.sonar;
  const sonar = configuredSonar?.wiring === 'not-used' || configuredSonar?.mode === 'disabled' ? null : configuredSonar;
  const codecov = quality?.codecov ?? { enabled: true, auth: 'oidc' };
  const audit = quality?.audit ?? { level: 'high', omitDev: true };
  const lcovArtifact = 'coverage-lcov';
  const build = frontendBuild(source, app);
  return {
    ciBuildEnv: build.env,
    ciBuildSteps: build.steps,
    ciLint: exampleCommand(source, 'npm run lint'),
    ciLintSonar: exampleCommand(source, 'npm run lint -- --sonar reports/lint.sonar.json'),
    ciCoverageProof: exampleCommand(source, 'npx starci app check --coverage-from ' + lcovReport),
    ciDatabaseLint: exampleCommand(source, 'npm run db:lint'),
    auditCommand: `npm audit${audit.omitDev ? ' --omit=dev' : ''} --audit-level=${audit.level}`,
    sonarTokenSecret: sonar?.token ?? 'SONAR_TOKEN',
    sonarHostVar: sonar?.hostVar ?? 'SONAR_HOST_URL',
    sonarEnv: sonar ? `    env:\n      SONAR_TOKEN: \${{ secrets.${sonar.token} }}` : '',
    ciLintSteps: [
      ...['be', 'fe'].flatMap((side) => [
        '      - name: lint ' + side,
        ...(sonar ? ["        if: env.SONAR_TOKEN == ''"] : []),
        `        run: ${exampleCommand(source, 'npm run lint -- --side ' + side)}`,
        '        env:',
        '          NODE_OPTIONS: --max-old-space-size=6144',
      ]),
      ...(sonar ? [
        ...['be', 'fe'].flatMap((side) => [
          '      - name: lint ' + side + ' with Sonar import',
          "        if: env.SONAR_TOKEN != ''",
          `        run: ${exampleCommand(source, 'npm run lint -- --side ' + side + ' --sonar reports/lint.' + side + '.sonar.json')}`,
          '        env:',
          '          NODE_OPTIONS: --max-old-space-size=6144',
        ]),
        ...sonarMergeSteps(),
        `      - uses: ${UPLOAD_ARTIFACT}`,
        "        if: always() && env.SONAR_TOKEN != '' && hashFiles('reports/lint.sonar.json') != ''",
        '        with:',
        '          name: sonar-lint',
        '          path: reports/lint.sonar.json',
      ] : []),
    ].join('\n'),
    codecovSteps: codecovSteps(lcovReport, codecov),
    sonarJob: sonarJob(sonar, lcovReport, lcovArtifact, nodeMajor),
    lcovArtifact,
  };
}
