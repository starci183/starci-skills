// Check routed frontend, backend and console repositories. This is deliberately check-only:
// commands come from package.json and credentials are read only from the process environment.
import {execFileSync, spawnSync} from "node:child_process";
import {existsSync, readFileSync, readdirSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {evaluateQualityGate} from "../machines/sonar-assurance/check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../..");
const args = process.argv.slice(2);

function redact(value) {
  let text = String(value ?? "");
  for (const [name, secret] of Object.entries(process.env)) {
    if (/(token|password|secret|credential|private[_-]?key)/i.test(name) && secret && secret.length >= 4) text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; } };
const routeRows = (root = source) => {
  const workspace = join(root, ".workspace");
  if (!existsSync(workspace)) return [];
  const rows = [];
  for (const project of readdirSync(workspace, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name)) {
    const projectRoot = join(workspace, project);
    for (const role of readdirSync(projectRoot, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name)) {
      const route = join(projectRoot, role, "config.json");
      if (!existsSync(route)) continue;
      const config = readJson(route);
      const diskPath = config?.repository?.diskPath;
      rows.push({project, role, route, diskPath: diskPath ? resolve(diskPath) : null, valid: Boolean(diskPath && existsSync(diskPath))});
    }
  }
  return rows;
};

const packageManager = (dir) => {
  const manifest = readJson(join(dir, "package.json"));
  const declared = String(manifest?.packageManager ?? "").split("@")[0];
  if (["npm", "pnpm", "yarn", "bun"].includes(declared)) return declared;
  const locks = ["npm", "pnpm", "yarn", "bun"].filter((manager) => manager === "npm" ? existsSync(join(dir, "package-lock.json")) : manager === "pnpm" ? existsSync(join(dir, "pnpm-lock.yaml")) : manager === "yarn" ? existsSync(join(dir, "yarn.lock")) : existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock")));
  return locks.length === 1 ? locks[0] : null;
};
const scriptsFor = (dir) => readJson(join(dir, "package.json"))?.scripts ?? {};
const firstScript = (scripts, names) => names.find((name) => typeof scripts[name] === "string" && scripts[name].trim());
function runScript(dir, name) {
  const manager = packageManager(dir);
  if (!manager) return {name, command: null, status: null, passed: false, output: "package manager is undeclared or lockfiles are ambiguous"};
  const executable = process.platform === "win32" ? `${manager}.cmd` : manager;
  const file = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : executable;
  const commandArgs = process.platform === "win32" ? ["/d", "/s", "/c", executable, "run", name] : ["run", name];
  const result = spawnSync(file, commandArgs, {cwd: dir, encoding: "utf8", shell: false, env: {...process.env, CI: process.env.CI || "true"}});
  return {name, command: `${manager} run ${name}`, status: result.status, passed: result.status === 0, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`};
}

const PROJECT_THRESHOLDS = {statements: 80, lines: 80, functions: 80, branches: 75};
const NEW_THRESHOLDS = {statements: 90, lines: 90, functions: 90, branches: 90};
const meets = (values, thresholds) => Object.entries(thresholds).every(([key, threshold]) => Number.isFinite(values[key]) && values[key] >= threshold);
function readLcov(file) {
  // LCOV carries line, function and branch counters but no distinct Istanbul statement total.
  // Never relabel DA lines as statements merely to make the four-metric gate measurable.
  const totals = {lines: [0, 0], functions: [0, 0], branches: [0, 0]};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const [kind, raw] = line.split(":", 2); if (!raw) continue;
    const value = Number(raw);
    if (kind === "FNF") totals.functions[1] += value; if (kind === "FNH") totals.functions[0] += value;
    if (kind === "LF") totals.lines[1] += value; if (kind === "LH") totals.lines[0] += value;
    if (kind === "BRF") totals.branches[1] += value; if (kind === "BRH") totals.branches[0] += value;
  }
  return {statements: NaN, ...Object.fromEntries(Object.entries(totals).map(([key, [hit, found]]) => [key, found ? hit / found * 100 : NaN]))};
}
function oneCoverage(dir, names, thresholds, summaries = [], {allowNotApplicable = false} = {}) {
  const candidates = summaries.map((name) => join(dir, name));
  for (const file of candidates) {
    const data = readJson(file);
    if (!data) continue;
    if (data.notApplicable === true) {
      return allowNotApplicable
        ? {file, notApplicable: true, reason: String(data.reason || "no changed production code"), pass: true}
        : {file, notApplicable: true, reason: String(data.reason || "missing coverage surface"), pass: false};
    }
    const total = data.total ?? data;
    const metric = (key) => Number(total[key]?.pct ?? total[key] ?? NaN);
    const values = {statements: metric("statements"), lines: metric("lines"), functions: metric("functions"), branches: metric("branches")};
    if (Object.values(values).every(Number.isFinite)) return {file, ...values, pass: meets(values, thresholds)};
  }
  for (const name of names) { const file = join(dir, name); if (existsSync(file)) { const values = readLcov(file); return {file, ...values, pass: meets(values, thresholds)}; } }
  return {file: null, pass: false, unmeasured: true};
}
function coverage(dir) {
  const project = oneCoverage(dir, ["coverage/lcov.info"], PROJECT_THRESHOLDS, ["coverage/coverage-summary.json", "coverage-summary.json"]);
  const change = oneCoverage(dir, ["coverage/patch.lcov.info", "coverage/new.lcov.info"], NEW_THRESHOLDS, ["coverage/patch-summary.json", "coverage/new-summary.json", "coverage/patch.json", "coverage/new.json"], {allowNotApplicable: true});
  return {project, change, pass: project.pass && change.pass};
}

function e2eSurface(dir, scripts) {
  const names = ["e2e", "test:e2e", "e2e:test"].filter((name) => typeof scripts[name] === "string" && scripts[name].trim());
  const roots = new Set(["e2e", "tests/e2e", "test/e2e", "src/tests/e2e", "playwright", "cypress", "src/e2e"].map((p) => join(dir, p)).filter(existsSync));
  const discover = (base) => {
    if (!existsSync(base)) return;
    for (const entry of readdirSync(base, {withFileTypes: true})) {
      if (!entry.isDirectory() || ["node_modules", "dist", "coverage", ".git", ".next"].includes(entry.name)) continue;
      const child = join(base, entry.name);
      if (["e2e", "playwright", "cypress"].includes(entry.name.toLowerCase())) roots.add(child);
      else discover(child);
    }
  };
  for (const top of ["src", "apps", "packages", "test", "tests"]) discover(join(dir, top));
  let files = 0;
  const testFile = (name) => /(?:^|[.-])(?:spec|test)\.[cm]?[jt]sx?$|\.feature$/.test(name);
  const walk = (p) => { for (const e of readdirSync(p, {withFileTypes: true})) { const f = join(p, e.name); if (e.isDirectory()) walk(f); else if (testFile(e.name)) files++; } };
  roots.forEach(walk);
  const source = [...roots].flatMap((root) => { const out = []; const visit = (p) => readdirSync(p, {withFileTypes: true}).forEach((e) => { const f = join(p, e.name); if (e.isDirectory()) visit(f); else if (testFile(e.name)) out.push(readFileSync(f, "utf8")); }); visit(root); return out; }).join("\n");
  const declaration = names.map((name) => String(scripts[name])).join("\n");
  return {scripts: names, files, exists: files > 0, blocked: /\.(?:skip|todo|only)\s*\(|passWithNoTests|--passWithNoTests|--pass-with-no-tests|--testNamePattern\b|(?:^|\s)-t(?:\s|=)/i.test(`${declaration}\n${source}`)};
}

export async function sonar(dir, {fetchImpl = fetch} = {}) {
  const config = readFileSync(join(dir, "sonar-project.properties"), "utf8");
  const key = config.match(/^sonar\.projectKey\s*=\s*(\S+)/m)?.[1];
  const host = process.env.SONAR_HOST_URL;
  const token = process.env.SONAR_TOKEN;
  const sha = (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], {cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim(); } catch { return null; } })();
  if (!key || !host || !token) return {status: "external-unmeasured", projectKey: key ?? null, sha};
  try {
    const auth = Buffer.from(`${token}:`).toString("base64");
    const headers = {authorization: `Basic ${auth}`};
    const statusResponse = await fetchImpl(`${host.replace(/\/$/, "")}/api/qualitygates/project_status?projectKey=${encodeURIComponent(key)}`, {headers});
    const status = await statusResponse.json();
    const strictKeys = ["bugs", "vulnerabilities", "code_smells", "new_bugs", "new_vulnerabilities", "new_code_smells", "reliability_rating", "security_rating", "sqale_rating", "security_hotspots_reviewed", "duplicated_lines_density", "new_duplicated_lines_density", "coverage", "new_coverage"];
    const measuresResponse = await fetchImpl(`${host.replace(/\/$/, "")}/api/measures/component?component=${encodeURIComponent(key)}&metricKeys=${strictKeys.join(",")}`, {headers});
    const measures = await measuresResponse.json();
    const analysesResponse = await fetchImpl(`${host.replace(/\/$/, "")}/api/project_analyses/search?project=${encodeURIComponent(key)}&ps=20`, {headers});
    const analyses = await analysesResponse.json();
    const latest = analyses.analyses?.[0];
    const metricRows = measures.component?.measures ?? [];
    const metricMap = Object.fromEntries(metricRows.map((item) => [item.metric, item.value ?? item.periods?.[0]?.value]));
    // The runner requires the strict profile; an absent response is missing evidence, never an exemption.
    const proof = evaluateQualityGate({status: status?.projectStatus?.status, analysis: {sha: latest?.revision ?? latest?.sha}, measures: metricMap}, {analysisSha: sha});
    return {status: proof.ok ? "pass" : "fail", qualityGate: status?.projectStatus?.status ?? "UNKNOWN", analysisId: latest?.key ?? null, metrics: metricMap, sha, projectKey: key, failures: proof.failures};
  } catch (error) { return {status: "external-unmeasured", projectKey: key, sha, reason: redact(error.message)}; }
}

export async function checkRepository(row, {execute = true, sonarEvidence = null} = {}) {
  if (!row.valid) return {...row, verdict: "fail", findings: ["route is missing or stale"]};
  const scripts = scriptsFor(row.diskPath);
  if (!packageManager(row.diskPath)) return {...row, verdict: "fail", findings: ["package manager is undeclared and lockfiles are missing or ambiguous"]};
  const lintName = firstScript(scripts, ["lint:check", "lint"]);
  const unitName = firstScript(scripts, ["test:ci", "test:unit", "test:coverage", "test:cov", "test"]);
  const e2e = e2eSurface(row.diskPath, scripts);
  const sourceRuns = execute ? [lintName, unitName].filter(Boolean).map((name) => runScript(row.diskPath, name)) : [];
  const lint = sourceRuns.find((r) => r.name === lintName) ?? {passed: false, unmeasured: true};
  const unit = sourceRuns.find((r) => r.name === unitName) ?? {passed: false, unmeasured: true};
  // Unit owns coverage. Capture its evidence before E2E runs so an E2E command can neither
  // contribute to, overwrite nor erase the LCOV/summary used by the coverage and Sonar lanes.
  const cov = coverage(row.diskPath);
  const e2eRuns = execute ? e2e.scripts.map((name) => runScript(row.diskPath, name)) : [];
  const sonarResult = sonarEvidence ?? (existsSync(join(row.diskPath, "sonar-project.properties")) ? await sonar(row.diskPath) : {status: "external-unmeasured", reason: "no sonar-project.properties"});
  const findings = [];
  if (!lintName || !lint.passed || /\b\d+\s+warning[s]?\b/i.test(lint.output ?? "") || /\b\d+\s+error[s]?\b/i.test(lint.output ?? "")) findings.push("lint is missing or not 0 errors/0 warnings");
  if (!unitName || !unit.passed) findings.push("unit test command is missing or failed");
  if (!cov.pass) findings.push("coverage is missing or below project statements/lines/functions 80% and branches 75%, or change/patch four-metric evidence 90%");
  const e2eFailed = e2eRuns.length !== e2e.scripts.length || e2eRuns.some((run) => !run.passed || /0\s+(?:tests?|specs?)\b|no tests? found/i.test(run.output ?? ""));
  if (e2e.scripts.length === 0 || !e2e.exists || e2e.blocked || e2eFailed) findings.push("full E2E commands/spec surface is missing, empty, skipped, todo, passWithNoTests or failed");
  if (sonarResult.status !== "pass") findings.push("Sonar quality gate, exact SHA or strict metrics are missing/unmeasured/failed");
  const publicCommand = (command) => command && {name: command.name, command: command.command, status: command.status, passed: command.passed, ...(command.unmeasured ? {unmeasured: true} : {})};
  return {...row, verdict: findings.length ? "fail" : "pass", commands: {lint: publicCommand(lint), unit: publicCommand(unit), e2e: e2eRuns.map(publicCommand)}, coverage: cov, e2e, sonar: sonarResult, findings: findings.map(redact)};
}

export async function runQuality({root = source, execute = true} = {}) {
  const rows = routeRows(root);
  const results = [];
  for (const row of rows) results.push(await checkRepository(row, {execute}));
  return {source: root, results, pass: results.length > 0 && results.every((r) => r.verdict === "pass")};
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const report = await runQuality({execute: !args.includes("--scan-only")});
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
}
