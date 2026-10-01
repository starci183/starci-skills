import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { main } from '../packages/hfs/bin/hfs.mjs';
import { APP, cleanup, installTypeScript, writeCleanRepo } from './_hfs-cli-fixture.mjs';

// `hfs new service | spec` (unit test standard): a service and its spec skeleton, the skeleton built from the constructor with the
// kit double the slot manifest names for each token. The specs generate into a temporary app (hfs new runs at the app root and writes
// under be/) and read the files back.
const ts = createRequire(import.meta.url)('typescript');
const made = [];
test.after(() => cleanup(made));

const repo = (declaration = APP) => {
  const dir = installTypeScript(writeCleanRepo(declaration));
  made.push(dir);
  return dir;
};
const cli = async (argv) => {
  let out = '';
  let err = '';
  const code = await main(argv, { stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
};
const read = (dir, relative) => fs.readFileSync(path.join(dir, ...relative.split('/')), 'utf8');
const put = (dir, relative, text) => {
  const target = path.join(dir, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};
/** The file parses: no syntax diagnostic. */
const parses = (text) => ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { experimentalDecorators: true } }).diagnostics.length === 0;

const DIR = 'be/src/modules/domain/commission';

test('a new service is written with a spec whose providers are exactly its constructor dependencies, each double from the kit table', async () => {
  const dir = repo();
  const result = await cli(['new', 'service', DIR, 'commission', '--repo', dir,
    '--inject', 'InjectPrimaryEntityManager=@modules/platform/database:EntityManager',
    '--inject', 'InjectClock=@modules/platform/clock:Clock',
    '--inject', 'InjectCommissionOptions=./commission.decorators:CommissionOptions',
    '--inject', 'InjectCache=@modules/integrations/cache:Cache',
    '--inject', 'InjectOutbox=@modules/platform/outbox:Outbox',
    '--inject', 'InjectChallengeLock=@modules/platform/lock:ChallengeLock',
    '--inject', 'InjectIds=@modules/platform/ids:Ids',
    '--inject', 'InjectKeycloakAdmin=@modules/integrations/keycloak-admin:KeycloakAdmin',
    '--inject', 'ProbeCheckerService=@modules/platform/probes']);
  assert.deepEqual([result.code, result.err], [0, '']);
  assert.equal(result.out, `created ${DIR}/commission.service.ts\ncreated ${DIR}/commission.service.spec.ts\n`);

  const service = read(dir, `${DIR}/commission.service.ts`);
  assert.match(service, /^import \{ Injectable \} from "@nestjs\/common"$/m);
  assert.match(service, /^@Injectable\(\)\n\/\*\* The commission service: state what it decides in one sentence\. \*\/\nexport class CommissionService \{\n {4}constructor\(\n/m);
  assert.match(service, /@InjectPrimaryEntityManager\(\) private readonly entityManager: EntityManager,/);
  assert.match(service, /private readonly probeCheckerService: ProbeCheckerService,/);
  assert.ok(parses(service));

  const spec = read(dir, `${DIR}/commission.service.spec.ts`);
  assert.equal(spec, `import { Test } from "@nestjs/testing"
import { fakeCache, FakeClock, fakeIds, fakeLock, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { CACHE } from "@modules/integrations/cache"
import { KEYCLOAK_ADMIN } from "@modules/integrations/keycloak-admin"
import type { KeycloakAdmin } from "@modules/integrations/keycloak-admin"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { CHALLENGE_LOCK } from "@modules/platform/lock"
import { OUTBOX } from "@modules/platform/outbox"
import { ProbeCheckerService } from "@modules/platform/probes"
import { COMMISSION_OPTIONS } from "./commission.decorators"
import { CommissionService } from "./commission.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    // Fill in the real values of the options this service reads: one case per flag branch.
    const commissionOptions = {}
    const cache = fakeCache(clock)
    const outbox = recordingOutbox()
    const challengeLock = fakeLock(clock)
    const ids = fakeIds()
    const keycloakAdmin = mock<KeycloakAdmin>()
    const probeCheckerService = mock<ProbeCheckerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CommissionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: COMMISSION_OPTIONS, useValue: commissionOptions },
            { provide: CACHE, useValue: cache },
            { provide: OUTBOX, useValue: outbox },
            { provide: CHALLENGE_LOCK, useValue: challengeLock },
            { provide: IDS, useValue: ids },
            { provide: KEYCLOAK_ADMIN, useValue: keycloakAdmin },
            { provide: ProbeCheckerService, useValue: probeCheckerService },
        ],
    }).compile()
    return {
        service: moduleRef.get(CommissionService),
        clock,
        entityManager,
        commissionOptions,
        cache,
        outbox,
        challengeLock,
        ids,
        keycloakAdmin,
        probeCheckerService,
    }
}

describe("CommissionService", () => {
    it("is built by the testing module with its constructor dependencies", async () => {
        const { service } = await build()
        expect(service).toBeInstanceOf(CommissionService)
    })
})
`);
  assert.ok(parses(spec));
});

test('a spec is read from an existing service: private, protected and static members are skipped, @Inject(TOKEN) and class parameters are followed', async () => {
  const dir = repo();
  put(dir, `${DIR}/payout-planner.service.ts`, `import { Inject, Injectable } from "@nestjs/common"
import { InjectCache } from "@modules/integrations/cache"
import type { Cache } from "@modules/integrations/cache"
import { LEDGER_STORE } from "@modules/domain/ledger"
import type { LedgerStore } from "@modules/domain/ledger"
import { RateService } from "./rate.service"

@Injectable()
export class PayoutPlannerService {
    constructor(
        @InjectCache() private readonly cache: Cache,
        @Inject(LEDGER_STORE) private readonly ledger: LedgerStore,
        private readonly rates: RateService,
    ) {}

    static of(): string {
        return "x"
    }

    async plan(): Promise<void> {}

    settle(): void {}

    private hidden(): void {}

    protected shared(): void {}
}
`);
  const result = await cli(['new', 'spec', `${DIR}/payout-planner.service.ts`, '--repo', dir]);
  assert.deepEqual([result.code, result.err, result.out], [0, '', `created ${DIR}/payout-planner.service.spec.ts\n`]);
  const spec = read(dir, `${DIR}/payout-planner.service.spec.ts`);
  assert.equal(spec, `import { Test } from "@nestjs/testing"
import { fakeCache, FakeClock, mock } from "@starci/jest-preset"
import { LEDGER_STORE } from "@modules/domain/ledger"
import type { LedgerStore } from "@modules/domain/ledger"
import { CACHE } from "@modules/integrations/cache"
import { RateService } from "./rate.service"
import { PayoutPlannerService } from "./payout-planner.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const cache = fakeCache(clock)
    const ledger = mock<LedgerStore>()
    const rates = mock<RateService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PayoutPlannerService,
            { provide: CACHE, useValue: cache },
            { provide: LEDGER_STORE, useValue: ledger },
            { provide: RateService, useValue: rates },
        ],
    }).compile()
    return { service: moduleRef.get(PayoutPlannerService), clock, cache, ledger, rates }
}

describe("PayoutPlannerService", () => {
    describe("plan", () => {
        it("plan has its first case written", async () => {
            const { service } = await build()
            expect(service.plan).toBeInstanceOf(Function)
        })
    })

    describe("settle", () => {
        it("settle has its first case written", async () => {
            const { service } = await build()
            expect(service.settle).toBeInstanceOf(Function)
        })
    })
})
`);
  assert.ok(parses(spec));
});

test('the skeleton satisfies the unit law by construction: kit-only doubles, no cast, no ambient clock, no module mock, no new of the service', async () => {
  const dir = repo();
  await cli(['new', 'service', DIR, 'settlement', '--repo', dir, '--inject', 'InjectPrimaryEntityManager=@modules/platform/database:EntityManager', '--inject', 'InjectClock=@modules/platform/clock:Clock']);
  const spec = read(dir, `${DIR}/settlement.service.spec.ts`);
  assert.doesNotMatch(spec, / as |!\.|!\)|Date\.now|new Date|process\.env|jest\.(mock|fn|doMock)|overrideProvider|imports:|new SettlementService/);
  assert.match(spec, /from "@starci\/jest-preset"/);
  assert.match(spec, /moduleRef\.get\(SettlementService\)/);
  assert.match(spec, /Test\.createTestingModule\(\{\n {8}providers: \[/);
});

test('a service without dependencies gets a providers list of the service alone', async () => {
  const dir = repo();
  await cli(['new', 'service', DIR, 'rounding', '--repo', dir]);
  const spec = read(dir, `${DIR}/rounding.service.spec.ts`);
  assert.match(spec, /providers: \[\n {12}RoundingService,\n {8}\],/);
  assert.doesNotMatch(spec, /FakeClock|mock\b|jest-preset/, 'no dependency, so no kit import');
  assert.match(spec, /^import \{ Test \} from "@nestjs\/testing"\nimport \{ RoundingService \} from "\.\/rounding\.service"$/m);
});

test('nothing is written outside a slot, over an existing file, for a bad name, for a front end or for a non-service file', async () => {
  const dir = repo();
  const stray = await cli(['new', 'service', 'be/src/stray', 'thing', '--repo', dir]);
  assert.equal(stray.code, 2);
  assert.match(stray.err, /^HFS_NEW_NO_SLOT: src\/stray\/thing\.service\.ts is owned by no slot/);
  assert.equal(fs.existsSync(path.join(dir, 'be/src/stray')), false);

  assert.equal((await cli(['new', 'service', DIR, 'commission', '--repo', dir])).code, 0);
  const again = await cli(['new', 'service', DIR, 'commission', '--repo', dir]);
  assert.equal(again.code, 2);
  assert.match(again.err, /^HFS_NEW_EXISTS: .*commission\.service\.ts already exists; hfs new never overwrites/);
  const specAgain = await cli(['new', 'spec', `${DIR}/commission.service.ts`, '--repo', dir]);
  assert.match(specAgain.err, /^HFS_NEW_EXISTS: .*commission\.service\.spec\.ts already exists/);

  const bad = await cli(['new', 'service', DIR, 'Bad_Name', '--repo', dir]);
  assert.match(bad.err, /^HFS_NEW_NAME_INVALID/);
  const notService = await cli(['new', 'spec', `${DIR}/commission.contracts.ts`, '--repo', dir]);
  assert.match(notService.err, /^HFS_NEW_NOT_A_SERVICE/);
  const missing = await cli(['new', 'spec', `${DIR}/nothing.service.ts`, '--repo', dir]);
  assert.match(missing.err, /^HFS_NEW_NO_SERVICE/);

  const fe = await cli(['new', 'service', 'fe/apps/web/src/modules/x', 'x', '--repo', dir]);
  assert.match(fe.err, /^HFS_NEW_BACKEND_ONLY/);
  const root = await cli(['new', 'service', 'src/modules/domain/x', 'x', '--repo', dir]);
  assert.match(root.err, /^HFS_NEW_BACKEND_ONLY/, 'a path outside be/ is refused, even one shaped like a back-end path');
});

test('a dependency the spec cannot provide is named, and usage errors exit 2', async () => {
  const dir = repo();
  put(dir, `${DIR}/odd.service.ts`, `import { Injectable } from "@nestjs/common"

@Injectable()
export class OddService {
    constructor(private readonly names: string) {}
}
`);
  const odd = await cli(['new', 'spec', `${DIR}/odd.service.ts`, '--repo', dir]);
  assert.equal(odd.code, 2);
  assert.match(odd.err, /^HFS_NEW_DEPENDENCY_UNKNOWN: .*parameter names is neither an @Inject\*\(\) token nor an imported class/);
  assert.match((await cli(['new', 'service', DIR, 'x', '--repo', dir, '--inject', 'InjectCache=@modules/x'])).err, /^HFS_NEW_INJECT_INVALID/);
  assert.equal((await cli(['new', 'thing', '--repo', dir])).code, 2);
  assert.equal((await cli(['new', 'service', DIR, '--repo', dir])).code, 2);
});
