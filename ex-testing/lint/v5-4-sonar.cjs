// Lane v5-4 helper: query sonar.starci.org for open vulnerabilities/bugs per BE project.
// Tokens are read from the SOPS-adjacent plaintext .key files at runtime and never printed.
const { readFileSync } = require('node:fs');

const HOST = 'https://sonar.starci.org';
const FILES_DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';

const PROJECTS = {
  'todo-be': { key: 'starci-todo-app-backend', token: 'sonarqube-todo-app-backend-token.key' },
  'ec-be': { key: 'starci-ecommerce-app-be', token: 'sonarqube-ecommerce-app-be-token.key' },
};

// Read-only fallbacks, used only when the project analysis token is rejected by the Web API.
const FALLBACK_TOKENS = ['sonarqube-admin-token.key', 'sonarqube-analysis-token.txt'];

function loadToken(file) {
  return readFileSync(`${FILES_DIR}/${file}`, 'utf8').trim();
}

async function call(path, token) {
  const res = await fetch(`${HOST}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// Tries the project token first, then the read-only fallbacks, and remembers which worked.
let chosen = null;
async function withToken(app, fn) {
  const candidates = [PROJECTS[app].token, ...FALLBACK_TOKENS];
  if (chosen && candidates.includes(chosen.file)) {
    candidates.sort((a, b) => (a === chosen.file ? -1 : b === chosen.file ? 1 : 0));
  }
  let last;
  for (const file of candidates) {
    let token;
    try {
      token = loadToken(file);
    } catch {
      continue;
    }
    try {
      const result = await fn(token, file);
      chosen = { file, app };
      return result;
    } catch (err) {
      last = err;
    }
  }
  throw new Error(`all token files failed for ${app}: ${last && last.message}`);
}

async function search(app, params) {
  const project = PROJECTS[app].key;
  return withToken(app, async (token, file) => {
    const issues = [];
    let components = [];
    let page = 1;
    for (;;) {
      // SonarQube 26.8 silently ignores `projectKeys` on this endpoint (it returns
      // instance-wide issues, no 400 on unknown keys) -- componentKeys is the selector
      // that actually scopes the result to one project.
      const path =
        `/api/issues/search?componentKeys=${encodeURIComponent(project)}&resolved=false&ps=100&p=${page}` +
        `&additionalFields=${encodeURIComponent('_all')}${params}`;
      const json = await call(path, token);
      issues.push(...json.issues);
      components = json.components || components;
      if (issues.length >= json.paging.total || json.issues.length === 0) break;
      page += 1;
    }
    const byId = new Map(components.map((c) => [c.key, c.longName || c.key]));
    return {
      via: file,
      total: issues.length,
      issues: issues.map((it) => ({
        rule: it.rule,
        severity: it.severity,
        type: it.type,
        component: byId.get(it.component) || it.component,
        line: it.line || null,
        message: it.message,
        status: (it._status && it._status.issueStatus) || it.issueStatus || null,
        effort: it.effort || null,
        tags: it.tags || [],
      })),
    };
  });
}

function print(report) {
  console.log(`token file used: ${report.via}`);
  console.log(`count: ${report.total}`);
  console.log(JSON.stringify(report.issues, null, 2));
}

async function main() {
  const cmd = process.argv[2];
  const apps = process.argv[3] ? [process.argv[3]] : Object.keys(PROJECTS);

  if (cmd === 'gate') {
    for (const app of apps) {
      const json = await withToken(app, (t) =>
        call(`/api/qualitygates/project_status?projectKey=${PROJECTS[app].key}`, t),
      );
      console.log(
        JSON.stringify(
          {
            app,
            project: PROJECTS[app].key,
            via: chosen.file,
            status: json.projectStatus.status,
            conditions: json.projectStatus.conditions,
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  if (cmd === 'counts') {
    for (const app of apps) {
      for (const type of ['VULNERABILITY', 'BUG', 'CODE_SMELL']) {
        const r = await search(app, `&types=${type}`);
        console.log(`${app} ${type}: ${r.total} (via ${r.via})`);
      }
    }
    return;
  }

  if (cmd === 'vulns') {
    for (const app of apps) {
      console.log(`\n===== ${app} VULNERABILITY =====`);
      print(await search(app, '&types=VULNERABILITY'));
      console.log(`----- ${app} BUG (BLOCKER/CRITICAL/MAJOR) -----`);
      print(await search(app, '&types=BUG&severities=BLOCKER,CRITICAL,MAJOR'));
    }
    return;
  }

  console.log('usage: node v5-4-sonar.cjs <gate|counts|vulns> [todo-be|ec-be]');
}

main().catch((err) => {
  console.error('FATAL', err.message);
  process.exitCode = 1;
});
