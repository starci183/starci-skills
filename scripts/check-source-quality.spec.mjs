import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {checkRepository, listDebts, sonar} from "./check-source-quality.mjs";

function fixture({lint = "node -e process.exit(0)", unit = "node -e process.exit(0)", e2e = "node -e process.exit(0)", secondE2e, coverage = true, e2eFiles = true, packageManager = "npm@11.0.0", temporaryDebt} = {}) {
  const dir = mkdtempSync(join(tmpdir(), "starci-quality-"));
  mkdirSync(join(dir, "e2e"));
  if (e2eFiles) writeFileSync(join(dir, "e2e", "smoke.e2e-spec.js"), "test('smoke', async () => {});\n");
  writeFileSync(join(dir, "package.json"), JSON.stringify({packageManager, scripts: {"lint:check": lint, "test:unit": unit, "test:e2e": e2e, ...(secondE2e ? {e2e: secondE2e} : {})}}));
  if (coverage) writeFileSync(join(dir, "coverage-summary.json"), JSON.stringify({total: {statements: {pct: 90}, lines: {pct: 90}, functions: {pct: 90}, branches: {pct: 80}}}));
  if (coverage) {
    const evidence = {total: {statements: {pct: 95}, lines: {pct: 95}, functions: {pct: 95}, branches: {pct: 95}}};
    mkdirSync(join(dir, "coverage"), {recursive: true});
    writeFileSync(join(dir, "coverage", "patch-summary.json"), JSON.stringify(evidence));
  }
  const debtPath = join(dir, "debt.md");
  if (temporaryDebt) writeFileSync(debtPath, `---\nversion: 1\nproject: fixture\nrole: fe\napprovedBy: ${temporaryDebt.approvedBy}\napprovedOn: ${temporaryDebt.approvedOn}\nexpiresOn: ${temporaryDebt.expiresOn}\nreason: ${temporaryDebt.reason}\nscopes: ${temporaryDebt.scopes.join(", ")}\n---\n\n# Temporary quality debt\n\n## Baseline\n\nMeasured baseline exists.\n\n## Exit criteria\n\n- Clear every named scope.\n`);
  return {project: "fixture", role: "fe", route: join(dir, "route.json"), debtPath, diskPath: dir, valid: true};
}

test("passes only when declared lint, unit, full E2E and concrete coverage evidence pass", async () => {
  const result = await checkRepository(fixture(), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "pass");
  assert.equal(result.coverage.pass, true);
  assert.equal(result.e2e.files, 1);
});

test("does not treat informational or absent coverage as measured", async () => {
  const result = await checkRepository(fixture({coverage: false}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /coverage is missing/);
});

test("requires patch and new-code branches to reach the full 90 percent", async () => {
  const row = fixture();
  const weak = {total: {statements: {pct: 95}, lines: {pct: 95}, functions: {pct: 95}, branches: {pct: 89}}};
  writeFileSync(join(row.diskPath, "coverage", "patch-summary.json"), JSON.stringify(weak));
  const result = await checkRepository(row, {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.equal(result.coverage.change.pass, false);
});

test("accepts explicit change coverage not-applicable only when the producer records no changed production", async () => {
  const row = fixture();
  writeFileSync(join(row.diskPath, "coverage", "patch-summary.json"), JSON.stringify({notApplicable: true, reason: "no changed production files"}));
  const result = await checkRepository(row, {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "pass");
  assert.equal(result.coverage.change.notApplicable, true);
});

test("fails nonzero lint and E2E even when a summary exists", async () => {
  const result = await checkRepository(fixture({lint: "node -e console.error('1 warning'); process.exit(1)", e2e: "node -e process.exit(1)"}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /lint/);
  assert.match(result.findings.join("; "), /E2E/);
  assert.doesNotMatch(result.findings.join("; "), /Sonar/);
});

test("captures unit coverage before E2E so E2E cannot become the coverage producer", async () => {
  const destructiveE2e = `node -e "require('node:fs').rmSync('coverage-summary.json');require('node:fs').rmSync('coverage/patch-summary.json')"`;
  const result = await checkRepository(fixture({e2e: destructiveE2e}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.coverage.pass, true);
  assert.equal(result.verdict, "pass");
});

test("rejects missing unit coverage even when E2E writes perfect coverage afterward", async () => {
  const row = fixture({coverage: false, e2e: "node write-e2e-coverage.cjs"});
  writeFileSync(join(row.diskPath, "write-e2e-coverage.cjs"), `
    const {mkdirSync, writeFileSync} = require("node:fs");
    const evidence = JSON.stringify({total: {statements: {pct: 100}, lines: {pct: 100}, functions: {pct: 100}, branches: {pct: 100}}});
    mkdirSync("coverage", {recursive: true});
    writeFileSync("coverage-summary.json", evidence);
    writeFileSync("coverage/patch-summary.json", evidence);
  `);
  const result = await checkRepository(row, {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.coverage.pass, false);
  assert.match(result.findings.join("; "), /coverage is missing/);
});

test("executes and requires every declared E2E entrypoint", async () => {
  const result = await checkRepository(fixture({secondE2e: "node -e process.exit(1)"}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.equal(result.commands.e2e.length, 2);
  assert(result.commands.e2e.some((command) => command.passed === false));
});

test("fails a zero-exit lint command that reports warnings", async () => {
  const result = await checkRepository(fixture({lint: "node -e console.log('1 warning')"}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.match(result.findings.join("; "), /lint/);
});

test("scan mode never executes a declared command", async () => {
  const result = await checkRepository(fixture({lint: "node -e process.exit(1)"}), {execute: false, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.equal(result.commands.lint.unmeasured, true);
});

test("fails closed when package manager identity is ambiguous", async () => {
  const result = await checkRepository(fixture({packageManager: null}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.match(result.findings.join("; "), /package manager/);
});

test("failing Sonar remains independent when E2E passes", async () => {
  const result = await checkRepository(fixture(), {execute: true, sonarEvidence: {status: "fail"}});
  assert.match(result.findings.join("; "), /Sonar/);
  assert.doesNotMatch(result.findings.join("; "), /E2E/);
});

test("records owner-approved project coverage and Sonar as debt without calling them pass", async () => {
  const temporaryDebt = {
    approvedBy: "owner",
    approvedOn: "2099-01-01",
    expiresOn: "2099-03-31",
    reason: "Temporary measured maturity debt.",
    scopes: ["source:project-coverage", "assurance:sonar"],
    baseline: {projectCoverage: {statements: 40}, sonar: "external-unmeasured"},
  };
  const result = await checkRepository(fixture({coverage: false, temporaryDebt}), {execute: true, sonarEvidence: {status: "fail"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /change\/patch/);

  const row = fixture({temporaryDebt});
  writeFileSync(join(row.diskPath, "coverage-summary.json"), JSON.stringify({total: {statements: {pct: 40}, lines: {pct: 40}, functions: {pct: 30}, branches: {pct: 35}}}));
  const accepted = await checkRepository(row, {execute: true, sonarEvidence: {status: "fail"}});
  assert.equal(accepted.verdict, "debt");
  assert.equal(accepted.deliveryAllowed, true);
  assert.equal(accepted.findings.length, 0);
  assert.match(accepted.debtFindings.join("; "), /project coverage/);
  assert.match(accepted.debtFindings.join("; "), /Sonar/);
});

test("expired or overlong debt fails closed", async () => {
  const result = await checkRepository(fixture({temporaryDebt: {
    approvedBy: "owner",
    approvedOn: "2020-01-01",
    expiresOn: "2099-12-31",
    reason: "Not temporary.",
    scopes: ["assurance:sonar"],
    baseline: {sonar: "unmeasured"},
  }}), {execute: true, sonarEvidence: {status: "fail"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /90 days/);
});

test("temporary debt never forgives lint, unit, patch or E2E failures", async () => {
  const temporaryDebt = {
    approvedBy: "owner",
    approvedOn: "2099-01-01",
    expiresOn: "2099-03-31",
    reason: "Scoped debt only.",
    scopes: ["source:project-coverage", "assurance:sonar"],
    baseline: {projectCoverage: {statements: 40}, sonar: "failed"},
  };
  const row = fixture({lint: "node -e process.exit(1)", e2e: "node -e process.exit(1)", temporaryDebt});
  writeFileSync(join(row.diskPath, "coverage", "patch-summary.json"), JSON.stringify({total: {statements: {pct: 89}, lines: {pct: 95}, functions: {pct: 95}, branches: {pct: 95}}}));
  const result = await checkRepository(row, {execute: true, sonarEvidence: {status: "fail"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /lint/);
  assert.match(result.findings.join("; "), /E2E/);
  assert.match(result.findings.join("; "), /change\/patch/);
});

test("lists Markdown debts by project and role without treating them as pass", () => {
  const root = mkdtempSync(join(tmpdir(), "starci-debt-list-"));
  const roleRoot = join(root, ".workspaces", "local", "routes", "fixture", "be");
  const debtRoot = join(root, ".worktrees", "fixture", "debts");
  mkdirSync(roleRoot, {recursive: true});
  mkdirSync(debtRoot, {recursive: true});
  writeFileSync(join(roleRoot, "config.json"), JSON.stringify({repository: {diskPath: root}}));
  writeFileSync(join(debtRoot, "be.md"), `---\nversion: 1\nproject: fixture\nrole: be\napprovedBy: owner\napprovedOn: 2099-01-01\nexpiresOn: 2099-03-31\nreason: Complex debt can be explained below.\nscopes: structure:legacy-tier\n---\n\n# Debt\n\n## Baseline\n\nA complex measured baseline.\n\n## Exit criteria\n\n- Remove the legacy tier.\n`);
  const report = listDebts({root, project: "fixture", role: "be", now: new Date("2099-02-01T00:00:00Z")});
  assert.equal(report.valid, true);
  assert.equal(report.records[0].verdict, "debt");
  assert.equal(report.records[0].debt.scopes[0], "structure:legacy-tier");
});

test("empty E2E surface fails even with unit and coverage evidence", async () => {
  const row = fixture({e2eFiles: false});
  const result = await checkRepository({...row, diskPath: row.diskPath}, {execute: false, sonarEvidence: {status: "pass"}});
  assert.match(result.findings.join("; "), /E2E/);
});

test("Sonar proof requests strict overall and new metrics and rejects incomplete evidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "starci-sonar-"));
  writeFileSync(join(dir, "sonar-project.properties"), "sonar.projectKey=fixture\n");
  const oldHost = process.env.SONAR_HOST_URL;
  const oldToken = process.env.SONAR_TOKEN;
  process.env.SONAR_HOST_URL = "https://sonar.invalid";
  process.env.SONAR_TOKEN = "test-only";
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (String(url).includes("project_status")) return {json: async () => ({projectStatus: {status: "OK"}})};
    if (String(url).includes("measures")) return {json: async () => ({component: {measures: [{metric: "coverage", value: "90"}]}})};
    return {json: async () => ({analyses: [{key: "a", revision: "missing"}]})};
  };
  const result = await sonar(dir, {fetchImpl});
  if (oldHost === undefined) delete process.env.SONAR_HOST_URL; else process.env.SONAR_HOST_URL = oldHost;
  if (oldToken === undefined) delete process.env.SONAR_TOKEN; else process.env.SONAR_TOKEN = oldToken;
  assert.equal(result.status, "fail");
  assert.ok(urls.some((url) => url.includes("new_coverage") && url.includes("new_bugs")));
  assert.ok(result.failures.some((failure) => failure.metric === "bugs"));
});

test("Sonar proof reads new-code conditions separately from overall measures", async () => {
  const dir = mkdtempSync(join(tmpdir(), "starci-sonar-conditions-"));
  writeFileSync(join(dir, "sonar-project.properties"), "sonar.projectKey=fixture\n");
  execFileSync("git", ["init"], {cwd: dir});
  execFileSync("git", ["config", "user.email", "fixture@example.invalid"], {cwd: dir});
  execFileSync("git", ["config", "user.name", "Fixture"], {cwd: dir});
  execFileSync("git", ["add", "sonar-project.properties"], {cwd: dir});
  execFileSync("git", ["commit", "-m", "fixture"], {cwd: dir});
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {cwd: dir, encoding: "utf8"}).trim();
  const oldHost = process.env.SONAR_HOST_URL;
  const oldToken = process.env.SONAR_TOKEN;
  process.env.SONAR_HOST_URL = "https://sonar.invalid";
  process.env.SONAR_TOKEN = "test-only";
  const fetchImpl = async (url) => {
    if (String(url).includes("project_status")) return {json: async () => ({projectStatus: {status: "OK", conditions: [
      {metricKey: "new_reliability_rating", actualValue: "1"},
      {metricKey: "new_security_rating", actualValue: "1"},
      {metricKey: "new_maintainability_rating", actualValue: "1"},
      {metricKey: "new_coverage", actualValue: "95"},
      {metricKey: "new_duplicated_lines_density", actualValue: "0"},
      {metricKey: "new_violations", actualValue: "0"},
    ]}})};
    if (String(url).includes("measures")) return {json: async () => ({component: {measures: [
      {metric: "bugs", value: "0"}, {metric: "vulnerabilities", value: "0"},
      {metric: "code_smells", value: "0"}, {metric: "reliability_rating", value: "1"},
      {metric: "security_rating", value: "1"}, {metric: "sqale_rating", value: "1"},
      {metric: "duplicated_lines_density", value: "0"}, {metric: "coverage", value: "90"},
      {metric: "security_hotspots", value: "0"},
    ]}})};
    return {json: async () => ({analyses: [{key: "a", revision: sha}]})};
  };
  const result = await sonar(dir, {fetchImpl});
  if (oldHost === undefined) delete process.env.SONAR_HOST_URL; else process.env.SONAR_HOST_URL = oldHost;
  if (oldToken === undefined) delete process.env.SONAR_TOKEN; else process.env.SONAR_TOKEN = oldToken;
  assert.equal(result.status, "pass");
  assert.equal(result.metrics.new_coverage, "95");
  assert.equal(result.metrics.new_bugs, 0);
  assert.equal(result.metrics.security_hotspots_reviewed, 100);
});

test("public report never exposes command output or known process secrets", async () => {
  const secret = "fixture-secret-value";
  const old = process.env.TEST_TOKEN;
  process.env.TEST_TOKEN = secret;
  const result = await checkRepository(fixture({lint: `node -e console.log(process.env.TEST_TOKEN)`}), {execute: true, sonarEvidence: {status: "pass"}});
  if (old === undefined) delete process.env.TEST_TOKEN; else process.env.TEST_TOKEN = old;
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /fixture-secret-value/);
  assert.doesNotMatch(serialized, /TEST_TOKEN/);
  assert.equal(result.commands.lint.name, "lint:check");
});
