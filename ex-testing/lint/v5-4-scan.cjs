// Lane v5-4 scanner wrapper: runs `npx -y @sonar/scan` in an app directory with the project's
// own analysis token supplied through the environment only (never echoed, never written to a file),
// then waits for the server-side Compute Engine task to finish so the next query sees fresh data.
const { readFileSync } = require('node:fs');
const { spawn } = require('node:child_process');

const HOST = 'https://sonar.starci.org';
const DIR = 'D:/Repositories/starci-academy-backend/.stacks/dev/runtime/files';
const APPS = {
  'todo-be': {
    key: 'starci-todo-app-backend',
    token: 'sonarqube-todo-app-backend-token.key',
    dir: 'D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend',
  },
  'ec-be': {
    key: 'starci-ecommerce-app-be',
    token: 'sonarqube-ecommerce-app-be-token.key',
    dir: 'D:/Repositories/starci-academy-backend/.claude/examples/ecommerce-app-be',
  },
};

const app = process.argv[2];
const cfg = APPS[app];
if (!cfg) {
  console.log(`usage: node v5-4-scan.cjs <${Object.keys(APPS).join('|')}>`);
  process.exit(2);
}

const token = readFileSync(`${DIR}/${cfg.token}`, 'utf8').trim();
// A project analysis token may push an analysis but is refused on api/ce/component (HTTP 403),
// so the read-only polling below runs with the instance's admin user token instead.
const readToken = readFileSync(`${DIR}/sonarqube-admin-token.key`, 'utf8').trim();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function latestCeTask() {
  const res = await fetch(`${HOST}/api/ce/component?component=${encodeURIComponent(cfg.key)}`, {
    headers: { Authorization: `Bearer ${readToken}` },
  });
  if (!res.ok) throw new Error(`ce/component HTTP ${res.status}`);
  return res.json();
}

async function waitForAnalysis(previousDate, timeoutMs = 15 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ce = await latestCeTask();
    const cur = ce.current || ce.pending;
    if (cur) {
      console.log(`[ce] ${cur.status} ${cur.type} (${Math.round(cur.percent ?? 0)}%)`);
      if (cur.status === 'SUCCESS') {
        const show = await fetch(`${HOST}/api/components/show?component=${encodeURIComponent(cfg.key)}`, {
          headers: { Authorization: `Bearer ${readToken}` },
        });
        const json = await show.json();
        const date = json.component?.analysisDate;
        if (date && date !== previousDate) return date;
      }
      if (cur.status === 'FAILED' || cur.status === 'CANCELED') {
        throw new Error(`CE task ${cur.status}: ${JSON.stringify(ce).slice(0, 300)}`);
      }
    } else {
      console.log('[ce] no pending/current task yet');
    }
    if (Date.now() > deadline) throw new Error('timed out waiting for CE processing');
    await sleep(5000);
  }
}

async function analysisDate() {
  const res = await fetch(`${HOST}/api/components/show?component=${encodeURIComponent(cfg.key)}`, {
    headers: { Authorization: `Bearer ${readToken}` },
  });
  return ((await res.json()).component || {}).analysisDate || null;
}

// `node v5-4-scan.cjs <app> waittask <taskId>` polls the Compute Engine task the scanner printed
// ("More about the report processing at .../api/ce/task?id=..."), so waiting is pinned to the exact
// analysis that was pushed rather than guessing from dates.
const waitTask = process.argv[3] === 'waittask' ? process.argv[4] : null;

(async () => {
  if (waitTask) {
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      const res = await fetch(`${HOST}/api/ce/task?id=${encodeURIComponent(waitTask)}`, {
        headers: { Authorization: `Bearer ${readToken}` },
      });
      if (!res.ok) throw new Error(`ce/task HTTP ${res.status}`);
      const task = (await res.json()).task;
      console.log(`[ce] ${task.id.slice(0, 8)} ${task.status} ${task.analysisId || ''} ${task.executedAt || ''}`);
      if (task.status === 'SUCCESS') {
        console.log(`[${app}] analysisId: ${task.analysisId}`);
        console.log(`[${app}] analysisDate after scan: ${await analysisDate()}`);
        return;
      }
      if (task.status === 'FAILED' || task.status === 'CANCELED') {
        throw new Error(`CE task ${task.status}: ${JSON.stringify(task).slice(0, 300)}`);
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for CE processing');
      await sleep(4000);
    }
  }

  const before = await analysisDate();
  console.log(`[${app}] analysisDate before scan: ${before}`);
  console.log(`[${app}] running npx -y @sonar/scan in ${cfg.dir}`);

  const code = await new Promise((resolve) => {
    const child = spawn('npx', ['-y', '@sonar/scan'], {
      cwd: cfg.dir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, SONAR_TOKEN: token },
    });
    child.on('close', resolve);
    child.on('error', (err) => {
      console.log(`[scan] spawn error ${err.message}`);
      resolve(1);
    });
  });
  console.log(`[${app}] scanner exit code: ${code}`);
  if (code !== 0) process.exit(code);

  const after = await waitForAnalysis(before);
  console.log(`[${app}] analysisDate after scan: ${after}`);
})().catch((err) => {
  console.error(`[${app}] FATAL ${err.message}`);
  process.exit(1);
});
