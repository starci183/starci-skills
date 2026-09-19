import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { stringify as stringifyYaml } from 'yaml';
import { FLOW_LOCATIONS, readAccounts, readFlowRecord, recordDigest } from './flow-records';
import { runDir } from './paths';
import { backendCommit, BASE_URL, currentRunId, frontendCommit } from './run-context';
import {
  ASSERTION_ANNOTATION,
  RESOURCE_ANNOTATION,
  WALK_STEP_ANNOTATION,
  type AssertionRecord,
  type ResourceEvent,
  type WalkStepRecord,
} from './steps';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const playwrightVersion = (): string => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'node_modules', '@playwright', 'test', 'package.json'), 'utf8'));
    return String(pkg.version ?? 'unknown');
  } catch {
    return 'unknown';
  }
};

const sha256File = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const findLocation = (test: TestCase) => {
  const flowId = test.parent?.title ?? '';
  return FLOW_LOCATIONS.find(entry => entry.id === flowId) ?? null;
};

const parseAnnotations = <T>(test: TestCase, type: string): T[] =>
  test.annotations.filter(a => a.type === type).map(a => JSON.parse(a.description ?? '{}') as T);

/**
 * ops/uat.verify/operator.yaml's evidence writer: for every flow this run touches, it appends one
 * `runs/<runId>/` folder under that flow's own `.starciwork` node (schemas/work-layout.yaml's
 * `uatFlow` shape, extended with an append-only `runs/` history this harness owns) carrying the op's
 * evidence file set. It never edits the record's own `index.yaml` or `evidence.yaml` - those are a
 * separate kernel act - and never deletes a previous run.
 */
export default class RunWriter implements Reporter {
  private runId = '';
  private baseURL = BASE_URL;
  private browserName = 'chromium';

  onBegin(config: FullConfig): void {
    // runId resolves lazily in onTestEnd: global-setup.ts has run by then (it precedes any test),
    // while read-only invocations like `--list` reach onBegin without it and must not crash here.
    this.runId = '';
    const project = config.projects[0];
    this.baseURL = (project?.use?.baseURL as string | undefined) ?? this.baseURL;
    this.browserName = project?.name ?? this.browserName;
    // eslint-disable-next-line no-console
    console.log(`[uat] evidence targets ${this.baseURL} (${this.browserName})`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const location = findLocation(test);
    if (!location) return; // A test outside the flow registry owns none of this evidence shape.
    if (result.status === 'skipped') return; // A declared test.skip() walked nothing; nothing to evidence.
    this.runId = currentRunId();

    const record = readFlowRecord(location.feature, location.flow);
    const accounts = readAccounts(location.feature, location.flow);
    const dir = runDir(location.feature, location.flow, this.runId);
    fs.mkdirSync(path.join(dir, 'screens'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'videos'), { recursive: true });

    const walkEntries = parseAnnotations<WalkStepRecord>(test, WALK_STEP_ANNOTATION);
    const assertions = parseAnnotations<AssertionRecord>(test, ASSERTION_ANNOTATION);
    const resourceEvents = parseAnnotations<ResourceEvent>(test, RESOURCE_ANNOTATION);

    const assets: Array<{ path: string; sha256: string; size: number }> = [];
    for (const attachment of result.attachments) {
      if (!attachment.path || !fs.existsSync(attachment.path)) continue;
      let dest: string | null = null;
      if (attachment.contentType === 'image/png') dest = path.join(dir, 'screens', `${attachment.name}.png`);
      else if (attachment.contentType === 'video/webm') dest = path.join(dir, 'videos', `${location.flow}.webm`);
      if (!dest) continue;
      fs.copyFileSync(attachment.path, dest);
      assets.push({
        path: path.relative(dir, dest).replaceAll('\\', '/'),
        sha256: sha256File(dest),
        size: fs.statSync(dest).size,
      });
    }

    fs.writeFileSync(
      path.join(dir, 'walk.json'),
      JSON.stringify({ schema: 'starci/uat-walk@1', flow: record.id, steps: walkEntries }, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, 'ux-checks.json'),
      JSON.stringify({ schema: 'starci/uat-ux-checks@1', flow: record.id, checks: assertions }, null, 2),
    );
    fs.writeFileSync(
      path.join(dir, 'flows.json'),
      JSON.stringify(
        { schema: 'starci/uat-flows@1', flow: { id: record.id, title: record.title, steps: record.steps, proves: record.proves } },
        null,
        2,
      ),
    );

    const observedCount = assertions.filter(a => a.observed !== 'not-run').length;
    const failedCount = assertions.filter(a => a.observed !== 'not-run' && a.observed !== a.expected).length;
    const outcome =
      assertions.length === 0 || observedCount === 0
        ? 'inconclusive'
        : failedCount > 0
          ? 'fail'
          : observedCount < assertions.length
            ? 'partial-pass'
            : 'pass';

    const manifest = {
      schema: 'starci/uat-run-manifest@1',
      id: `${record.id}.runs.${this.runId}`,
      nodeId: record.id,
      inputDigest: recordDigest(location.feature, location.flow),
      outcome,
      assertions,
      assets,
      provenance: {
        tool: 'playwright',
        version: playwrightVersion(),
        browser: this.browserName,
        baseURL: this.baseURL,
        frontendCommit: frontendCommit(),
        backendCommit: backendCommit(),
      },
    };
    fs.writeFileSync(path.join(dir, 'manifest.yaml'), stringifyYaml(manifest));

    fs.writeFileSync(
      path.join(dir, 'run-ledger.json'),
      JSON.stringify(
        {
          schema: 'starci/uat-run-ledger@1',
          runId: this.runId,
          flow: record.id,
          started: result.startTime.toISOString(),
          finished: new Date(result.startTime.getTime() + result.duration).toISOString(),
          accountsDeclared: accounts.map(a => ({ role: a.role, username: a.username })),
          reused: [],
          created: resourceEvents.filter(e => e.action === 'created').map(e => ({ kind: e.kind, id: e.id, note: e.note })),
        },
        null,
        2,
      ),
    );

    fs.writeFileSync(
      path.join(dir, 'readback.json'),
      JSON.stringify(
        {
          schema: 'starci/uat-readback@1',
          flow: record.id,
          checked: assertions.filter(a => a.observed !== 'not-run').map(a => a.id),
          notRun: assertions.filter(a => a.observed === 'not-run').map(a => a.id),
        },
        null,
        2,
      ),
    );

    const created = resourceEvents.filter(e => e.action === 'created');
    const deleted = resourceEvents.filter(e => e.action === 'deleted');
    const verifiedAbsent = resourceEvents.filter(e => e.action === 'verified-absent');
    fs.writeFileSync(
      path.join(dir, 'cleanup.json'),
      JSON.stringify(
        {
          schema: 'starci/uat-cleanup@1',
          flow: record.id,
          ownedResourcesCreated: created.map(e => ({ kind: e.kind, id: e.id, note: e.note })),
          ownedResourcesDeleted: deleted.map(e => ({ kind: e.kind, id: e.id, note: e.note })),
          verifiedAbsent: verifiedAbsent.map(e => ({ kind: e.kind, id: e.id, note: e.note })),
          note:
            created.length === 0
              ? 'This run created no run-owned fixture rows against a database this lane owns; nothing to clean up.'
              : created.length === deleted.length && created.length === verifiedAbsent.length
                ? 'Every run-owned resource this run created was deleted and its absence verified by read-back.'
                : 'Unresolved owned resource(s) remain - see ownedResourcesCreated vs ownedResourcesDeleted/verifiedAbsent.',
        },
        null,
        2,
      ),
    );

    const resultMd = [
      `# ${record.title}`,
      '',
      // Plain text after "Outcome: ", never markdown-bolded: scripts/check-example-work.mjs's concept
      // 12 refuses a done uat-flow record whose run's result.md does not match /outcome:\s*pass/i, and
      // the emphasis markers used to sit directly between the colon and the word, breaking that match
      // for the first run this harness ever settled a done record against.
      `Flow: \`${record.id}\`  Run: \`${this.runId}\`  Outcome: ${outcome}`,
      '',
      '## Steps walked',
      ...(walkEntries.length ? walkEntries.map(w => `- \`${w.step}\` (${w.startedAt} -> ${w.endedAt})`) : ['- (none reached)']),
      '',
      '## Assertions',
      ...(assertions.length
        ? assertions.map(a => `- \`${a.id}\`: expected ${a.expected}, observed ${a.observed} - ${a.note}`)
        : ['- (none recorded)']),
      '',
      '## Redaction',
      'Every screenshot and video frame was reviewed for the password field, which Playwright masks at ' +
        "capture time (`page.screenshot({ mask: [...] })`) whenever a password input is present on the page.",
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'result.md'), resultMd);
  }
}
