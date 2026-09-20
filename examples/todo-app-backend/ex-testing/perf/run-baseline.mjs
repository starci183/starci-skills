#!/usr/bin/env node
/**
 * ex-testing/perf/run-baseline.mjs — drive the five heaviest todo-app journeys through autocannon
 * and write ex-testing/perf/baseline-<ts>.json.
 *
 * Why autocannon: the wave brief asks for k6 or autocannon; k6 is not on this machine and autocannon
 * is runnable without touching package.json (`npx --yes autocannon`). Each journey is one GraphQL
 * POST per connection loop; the runner signs in once and stamps the bearer token into every request.
 *
 * Usage:
 *   node ex-testing/perf/run-baseline.mjs [--duration 15] [--connections 10] [--base http://localhost:3001]
 *
 * Requires: backend on :3001 against the seeded dev stack (compose-postgres-1). The demo account
 * owns ~4k tasks, 468 audit lines, 2k notifications, live recurrence rules and shared tasks — the
 * journey arguments below name that seeded data, so re-seed with .starcistacks/dev/seeds if the
 * database has been reset.
 */
import { spawnSync } from 'node:child_process';
import fs, { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : fallback;
};
const BASE = arg('base', 'http://localhost:3001');
const DURATION = String(arg('duration', 15));
const CONNECTIONS = String(arg('connections', 10));
const EMAIL = arg('email', 'demo@todo.dev');
const PASSWORD = arg('password', 'todo-demo-pass');

const JOURNEYS = [
    {
        id: 'task-list',
        note: 'fr.task.list — the caller\'s full task list (~4.1k rows seeded). The resolver paginates nothing; the "paginated" brief item is exercised as the heaviest list read the API actually exposes.',
        body: { query: '{ tasks { taskId title complete } }' },
    },
    {
        id: 'recur-expansion',
        note: 'upcomingOccurrences on a live every-weekday rule — materialisation + live previewDates computation.',
        body: { query: '{ upcomingOccurrences(ruleId: "ec0de4d5-adc4-4234-a512-7e7efdfe1d43") { ruleId previewDates materialised { occurrenceId localDate dueAtUtc status } } }' },
    },
    {
        id: 'share-fan-out',
        note: 'collaborators on a task holding pending+revoked+accepted invitations — the share read path behind every fan-out.',
        body: { query: '{ collaborators(taskId: "7b5fdf63-950a-419c-a75f-ca3c04313a7e") { invitationId email role status } }' },
    },
    {
        id: 'notify-digest',
        note: 'notificationPreferences read — the digest path itself is write-side (digest windows flush on delivery); this is the heaviest notify read the schema exposes.',
        body: { query: '{ notificationPreferences(channel: "email") { channel unsubscribed digestWindowMinutes } }' },
    },
    {
        id: 'audit-export',
        note: 'exportMyData — decrypts every audit line naming the caller (468 seeded). The heaviest single read.',
        body: { query: '{ exportMyData { at action target } }' },
    },
];

const signIn = async () => {
    const res = await fetch(`${BASE}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            query: `mutation { signIn(input: {email: "${EMAIL}", password: "${PASSWORD}"}) { sessionToken } }`,
        }),
    });
    const json = await res.json();
    const token = json?.data?.signIn?.sessionToken;
    if (!token) throw new Error(`sign-in failed: ${JSON.stringify(json)}`);
    return token;
};

const runJourney = (journey, token) => {
    // autocannon's -i reads the request body from a file - avoids every shell-quoting edge the JSON
    // body would hit if it went through a cmd line. npx.cmd + shell:false keeps argv intact on Windows.
    const bodyFile = path.join(here, `.tmp-body-${journey.id}.json`);
    writeFileSync(bodyFile, JSON.stringify(journey.body));
    const args = [
        '--yes', 'autocannon', '--json',
        '-d', DURATION, '-c', CONNECTIONS,
        '-m', 'POST',
        '-H', 'content-type=application/json',
        '-H', `authorization=Bearer ${token}`,
        '-i', bodyFile,
        `${BASE}/graphql`,
    ];
    // npx on Windows only resolves through a shell; shell:true concatenates argv, so any arg holding
    // a space (the Bearer header, an absolute path) must carry its own quotes.
    const quoted = args.map(a => (a.includes(' ') ? `"${a}"` : a));
    const proc = spawnSync(process.platform === 'win32' ? 'npx' : 'npx', quoted,
        { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
    try { fs.unlinkSync(bodyFile); } catch { /* temp cleanup is best-effort */ }
    if (proc.status !== 0) {
        return { id: journey.id, error: `autocannon exited ${proc.status}: ${(proc.stderr || proc.stdout || '').slice(0, 500)}` };
    }
    let result;
    try {
        result = JSON.parse(proc.stdout);
    } catch {
        return { id: journey.id, error: `unparseable autocannon output: ${proc.stdout.slice(0, 300)}` };
    }
    // autocannon's default percentile set is 1/2.5/10/25/50/75/90/97.5/99/99.9 - there is no p95 key;
    // report p97_5 labelled honestly rather than silently substituting it.
    const lat = result.latency ?? {};
    const sent = result.requests?.sent ?? result.requests?.total ?? null;
    return {
        id: journey.id,
        note: journey.note,
        requestsSent: sent,
        throughputRps: result.requests?.average ?? null,
        latencyMs: {
            avg: lat.average ?? null,
            p50: lat.p50 ?? null,
            p97_5: lat.p97_5 ?? null,
            p99: lat.p99 ?? null,
            p999: lat.p999 ?? null,
            max: lat.max ?? null,
        },
        errors: result.errors ?? 0,
        timeouts: result.timeouts ?? 0,
        non2xx: result.non2xx ?? 0,
        // GraphQL failures come back HTTP 200 with an errors[] body; this rate counts transport and
        // HTTP failures only, which is the honest floor - assertion-level failures need a different tool.
        errorRate: sent ? ((result.errors ?? 0) + (result.non2xx ?? 0)) / sent : null,
    };
};

const main = async () => {
    const token = await signIn();
    console.log(`signed in as ${EMAIL}; running ${JOURNEYS.length} journeys (${DURATION}s x ${CONNECTIONS} conn) against ${BASE}`);
    const journeys = [];
    for (const journey of JOURNEYS) {
        process.stdout.write(`  ${journey.id} ... `);
        const r = runJourney(journey, token);
        console.log(r.error ? `FAILED: ${r.error}` : `p50=${r.latencyMs.p50}ms p97.5=${r.latencyMs.p97_5}ms p99=${r.latencyMs.p99}ms rps=${r.throughputRps} err=${r.errorRate}`);
        journeys.push(r);
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const report = {
        generated: new Date().toISOString(),
        base: BASE,
        durationSeconds: Number(DURATION),
        connections: Number(CONNECTIONS),
        tool: 'autocannon (via npx, k6 not installed on this machine)',
        seedAccount: EMAIL,
        journeys,
        draftSLOs: {
            note: 'Draft only — measured, not enforced. Keys are p97_5 because that is the nearest percentile autocannon emits; treat as the p95 line.',
            taskList: { p97_5Ms: 800, note: 'full unbounded list; revisit if pagination lands' },
            recurExpansion: { p97_5Ms: 300 },
            shareFanOut: { p97_5Ms: 200 },
            notifyDigest: { p97_5Ms: 200 },
            auditExport: { p97_5Ms: 1500, note: 'decrypts every line; scales with log size' },
            errorRate: { max: 0.01 },
        },
    };
    const file = path.join(here, `baseline-${ts}.json`);
    writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`wrote ${file}`);
};

main().catch((e) => { console.error(e); process.exitCode = 1; });
