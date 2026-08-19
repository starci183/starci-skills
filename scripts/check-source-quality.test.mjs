import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {checkRepository, sonar} from "./check-source-quality.mjs";

function fixture({lint = "node -e process.exit(0)", unit = "node -e process.exit(0)", e2e = "node -e process.exit(0)", secondE2e, coverage = true, e2eFiles = true, packageManager = "npm@11.0.0"} = {}) {
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
  return {project: "fixture", role: "fe", route: join(dir, "route.json"), diskPath: dir, valid: true};
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

test("fails nonzero lint and E2E even when a summary exists", async () => {
  const result = await checkRepository(fixture({lint: "node -e console.error('1 warning'); process.exit(1)", e2e: "node -e process.exit(1)"}), {execute: true, sonarEvidence: {status: "pass"}});
  assert.equal(result.verdict, "fail");
  assert.match(result.findings.join("; "), /lint/);
  assert.match(result.findings.join("; "), /E2E/);
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

test("missing Sonar evidence makes an otherwise measured role fail", async () => {
  const result = await checkRepository(fixture(), {execute: false});
  assert.match(result.findings.join("; "), /Sonar/);
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
