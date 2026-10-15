// One command vocabulary for managed CI rendering and the runtime coverage gate.
const exampleCommand = (source, command) => source?.runtimeExample
  ? 'node node_modules/@starci/hfs/runtime/scripts/hfs/example-secrets.mjs --run . -- ' + command
  : command;

export function ciWorkflowCommands(source, lcovReport = 'be/coverage/lcov.info') {
  return {
    ciLint: exampleCommand(source, 'npm run lint'),
    ciLintSonar: exampleCommand(source, 'npm run lint -- --sonar reports/lint.sonar.json'),
    ciCoverageProof: exampleCommand(source, 'npx starci app check --coverage-from ' + lcovReport),
    ciDatabaseLint: exampleCommand(source, 'npm run db:lint'),
  };
}
