import fs from 'node:fs';

// One command vocabulary for managed CI rendering and the runtime coverage gate.
const exampleCommand = (source, command) => source?.runtimeExample
  ? 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ' + command
  : command;

const UPLOAD_ARTIFACT = 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2';
const DOWNLOAD_ARTIFACT = 'actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4.3.0';
const SONAR_CONDITION = "${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') && env.SONAR_TOKEN != '' }}";

/** Codecov reports missing coverage without failing twice; uploads retain the release-tag condition and required authentication. */
function codecovSteps(lcovReport, codecov) {
  if (codecov.enabled === false || codecov.wiring === 'not-used') return [
    '      - name: coverage upload',
    '        run: echo "codecov disabled in .starcistacks/application-stacks.yaml"',
  ].join('\n');
  return [
    '      - name: coverage upload skipped',
    `        if: \${{ !cancelled() && hashFiles('${lcovReport}') == '' }}`,
    '        run: |',
    `          echo "::notice::codecov upload skipped: no coverage file at ${lcovReport} (the test step failed or produced none)"`,
    '          exit 0',
    '      - name: coverage upload',
    '        uses: codecov/codecov-action@0fb7174895f61a3b6b78fc075e0cd60383518dac # v5.5.5',
    `        if: \${{ !cancelled() && startsWith(github.ref, 'refs/tags/v') && hashFiles('${lcovReport}') != '' }}`,
    '        with:',
    codecov.auth === 'token' ? `          token: \${{ secrets.${codecov.token} }}` : '          use_oidc: true',
    `          files: ${lcovReport}`,
    '          disable_search: true',
    '          fail_ci_if_error: true',
  ].join('\n');
}

/** Sonar consumes the test coverage and fast lint artifacts only on release tags with a configured token. */
function sonarJob(sonar, lcovReport, lcovArtifact, nodeMajor) {
  if (!sonar) return '';
  const header = [
    '  sonar:',
    '    needs: [fast, test]',
    '    runs-on: ubuntu-latest',
    '    env:',
    `      SONAR_TOKEN: \${{ secrets.${sonar.token} }}`,
    `      SONAR_HOST_URL: \${{ vars.${sonar.hostVar} }}`,
    '    steps:',
  ].join('\n');
  const steps = [
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${SONAR_CONDITION}`,
    '        with:',
    `          name: ${lcovArtifact}`,
    `          path: ${lcovReport.split('/').slice(0, -1).join('/') || '.'}`,
    `      - uses: ${DOWNLOAD_ARTIFACT}`,
    `        if: ${SONAR_CONDITION}`,
    '        with:',
    '          name: sonar-lint',
    '          path: reports',
    '      - uses: SonarSource/sonarqube-scan-action@c7ee0f9df90b7aa20e8dcf9695dcfe2e7da5b4f2 # v7.2.1',
    `        if: ${SONAR_CONDITION}`,
    '      - uses: SonarSource/sonarqube-quality-gate-action@7a5fffe8e523c40e0c740b6bc2712ab503e52efa # v1.2.1',
    `        if: ${SONAR_CONDITION}`,
    '        timeout-minutes: 10',
  ].join('\n');
  // Variable strings are inserted after render() expands partials, so resolve Sonar's shared install partial before insertion.
  const read = name => fs.readFileSync(new URL('../templates/app/ci-workflows/' + name, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  return read('sonar-steps.yml')
    .replace('{{> app/ci-workflows/install-steps.yml}}', () => read('install-steps.yml').trimEnd())
    .replaceAll('{{nodeMajor}}', nodeMajor)
    .replace('{{sonarJobHeader}}', () => header)
    .replace('{{sonarJobSteps}}', () => steps)
    .trimEnd();
}

/** An omitted quality declaration preserves hosted Sonar, required OIDC Codecov, and the high production dependency audit. */
export function ciWorkflowCommands(source, lcovReport = 'be/coverage/lcov.info', quality = undefined, { nodeMajor = '22' } = {}) {
  const configuredSonar = quality === undefined ? { token: 'SONAR_TOKEN', hostVar: 'SONAR_HOST_URL' } : quality.sonar;
  const sonar = configuredSonar?.wiring === 'not-used' || configuredSonar?.mode === 'disabled' ? null : configuredSonar;
  const codecov = quality?.codecov ?? { enabled: true, auth: 'oidc' };
  const audit = quality?.audit ?? { level: 'high', omitDev: true };
  const lcovArtifact = 'coverage-lcov';
  return {
    ciLint: exampleCommand(source, 'npm run lint'),
    ciLintSonar: exampleCommand(source, 'npm run lint -- --sonar reports/lint.sonar.json'),
    ciCoverageProof: exampleCommand(source, 'npx starci app check --coverage-from ' + lcovReport),
    ciDatabaseLint: exampleCommand(source, 'npm run db:lint'),
    auditCommand: `npm audit${audit.omitDev ? ' --omit=dev' : ''} --audit-level=${audit.level}`,
    sonarTokenSecret: sonar?.token ?? 'SONAR_TOKEN',
    sonarHostVar: sonar?.hostVar ?? 'SONAR_HOST_URL',
    sonarEnv: sonar ? `    env:\n      SONAR_TOKEN: \${{ secrets.${sonar.token} }}` : '',
    ciLintSteps: [
      '      - name: lint',
      ...(sonar ? ["        if: env.SONAR_TOKEN == ''"] : []),
      `        run: ${exampleCommand(source, 'npm run lint')}`,
      '        env:',
      '          NODE_OPTIONS: --max-old-space-size=6144',
      ...(sonar ? [
        '      - name: lint with Sonar import',
        "        if: env.SONAR_TOKEN != ''",
        `        run: ${exampleCommand(source, 'npm run lint -- --sonar reports/lint.sonar.json')}`,
        '        env:',
        '          NODE_OPTIONS: --max-old-space-size=6144',
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
