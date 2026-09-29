import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROUTE_PLAN = path.join(ROOT, 'scripts', 'route', 'route-plan.mjs');
const DEFINE_GOAL = path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs');

// A two-repository Work tree: `wishlist` holds done backend + frontend + spec records, `billing` is fully done.
function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-extend-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const work = path.join(repo, '.starciwork');
  const put = (rel, body) => {
    fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
    fs.writeFileSync(path.join(work, rel), body);
  };
  put('workspace.yaml', 'schema: work/workspace@1\nid: shop\nproject: shop\nrepositories:\n  - {role: be, name: shop-backend}\n  - {role: fe, name: shop-frontend}\n');
  const rec = (rel, schema, id, state, extra = '') => put(rel, `schema: ${schema}\nid: ${id}\ntitle: ${id}\nstate: ${state}\n${extra}`);
  rec('features/wishlist/br/one-per-item/index.yaml', 'work/business-rule@1', 'br.wishlist.one-per-item', 'done');
  rec('features/wishlist/sds/store/index.yaml', 'work/sds-component@1', 'sds.wishlist.store', 'done');
  rec('features/wishlist/impl/shop-backend/store/index.yaml', 'work/implementation@1', 'impl.wishlist.shop-backend.store', 'done', 'repository: shop-backend\n');
  rec('features/wishlist/impl/shop-frontend/list/index.yaml', 'work/implementation@1', 'impl.wishlist.shop-frontend.list', 'done', 'repository: shop-frontend\n');
  rec('features/billing/br/invoice/index.yaml', 'work/business-rule@1', 'br.billing.invoice', 'done');
  rec('features/billing/impl/shop-backend/invoice/index.yaml', 'work/implementation@1', 'impl.billing.shop-backend.invoice', 'done', 'repository: shop-backend\n');
  return { repo, work };
}

const plan = (text, ...extra) => {
  const r = spawnSync(process.execPath, [ROUTE_PLAN, '--text', text, '--json', ...extra], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const ops = p => p.legs.map(l => l.op);
const hasEdge = (p, from, to) => p.edges.some(([a, b]) => a === from && b === to);

test('an EXTEND of a feature that holds backend records plans backend.implement even when the prompt names only the interface', t => {
  const { work } = fixture(t);
  const p = plan('extend the wishlist page with a share button', '--state', work);
  assert.equal(p.impact.shape, 'EXTEND');
  assert.deepEqual(p.impact.features, ['wishlist']);
  assert.ok(ops(p).includes('backend.implement'), ops(p).join(','));
  assert.equal(p.legs.find(l => l.op === 'backend.implement').extends, 'impl.wishlist.shop-backend.store');
  // draw gate: the backend build starts only after the design is drawn, like the frontend build.
  assert.ok(ops(p).indexOf('interface.draw') < ops(p).indexOf('backend.implement'));
  assert.ok(hasEdge(p, 'interface.draw', 'backend.implement'));
  assert.ok(hasEdge(p, 'interface.draw', 'interface.implement'));
  // MVP: no e2e/uat/integration leg unless asked.
  assert.deepEqual(ops(p).filter(o => /^(e2e|uat|integration)\.verify$/.test(o)), []);
});

test('an EXTEND does only the delta: settled specs of the feature and other features are not re-planned', t => {
  const { work } = fixture(t);
  const prompt = 'add a share option to the existing wishlist feature, backend and frontend';
  const p = plan(prompt, '--state', work);
  assert.equal(p.impact.shape, 'EXTEND');
  assert.ok(!ops(p).includes('business.decide') && !ops(p).includes('architecture.decide'), ops(p).join(','));
  assert.deepEqual(ops(p).filter(o => /implement$/.test(o)), ['backend.implement', 'interface.implement']);
  assert.deepEqual([...p.impact.reusedDone].sort(), ['br.wishlist.one-per-item', 'impl.wishlist.shop-backend.store', 'impl.wishlist.shop-frontend.list', 'sds.wishlist.store']);
  assert.equal(p.impact.settledOutOfScope, 2, 'the billing records are surveyed and left alone');
  assert.ok(!JSON.stringify(p.legs).includes('billing'), 'no leg extends another feature');
  // the same prompt without a survey has no impact block and still plans both lanes
  const blind = plan(prompt);
  assert.equal(blind.impact, undefined);
  assert.ok(ops(blind).includes('backend.implement') && ops(blind).includes('interface.implement'));
});

test('a done record never stands in for a goal unit it is not: wildcards and lanes', t => {
  const { work } = fixture(t);
  // an unnamed backend build is not already true because some backend record elsewhere is done
  const be = plan('build the backend API for reports', '--state', work);
  assert.equal(be.impact.shape, 'BUILD');
  // a BUILD names no surveyed feature: nothing existing settles its decide legs or its backend build
  assert.deepEqual(ops(be).filter(o => /decide$|implement$/.test(o)), ['business.decide', 'architecture.decide', 'backend.implement']);
  assert.deepEqual(be.alreadySatisfied, []);
  // a frontend-only build of a feature the survey does not hold stays frontend-only
  const ui = plan('build the reports screen frontend', '--state', work);
  assert.ok(ops(ui).includes('interface.implement') && !ops(ui).includes('backend.implement'));
});

test('a done frontend record does not satisfy a backend goal variable', t => {
  const { repo } = fixture(t);
  const work = path.join(repo, '.starciwork');
  for (const dir of ['impl/shop-backend', 'br', 'sds']) fs.rmSync(path.join(work, 'features', 'wishlist', dir), { recursive: true });
  fs.rmSync(path.join(work, 'features', 'billing'), { recursive: true });
  const r = spawnSync(process.execPath, [ROUTE_PLAN, '--target', 'impl.list: done', '--state', work, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  assert.equal(r.status, 0, r.stderr);
  const p = JSON.parse(r.stdout);
  // impl.list is a done FRONTEND record; the explicit target has no lane, so it is satisfied by it and plans nothing
  assert.deepEqual(p.alreadySatisfied.map(s => s.by), ['impl.wishlist.shop-frontend.list']);
  const backend = spawnSync(process.execPath, [ROUTE_PLAN, '--text', 'extend the wishlist page with a share button', '--state', work, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const q = JSON.parse(backend.stdout);
  assert.ok(!ops(q).includes('backend.implement'), 'no backend record in the feature: nothing to extend on the backend');
  assert.ok(ops(q).includes('interface.implement'));
});

test('define-goal --plan runs the survey and reports the IMPACT with the backend lane', t => {
  const { repo } = fixture(t);
  const r = spawnSync(process.execPath, [DEFINE_GOAL, '--repo', repo, '--text', 'extend the wishlist page with a share button', '--title', 'x', '--plan', '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.impact.shape, 'EXTEND');
  assert.ok(out.opChain.includes('backend.implement'));
  assert.ok(!out.opChain.includes('business.decide'));
  assert.deepEqual(fs.readdirSync(path.join(repo, '.starciwork')).sort(), ['features', 'workspace.yaml'], '--plan writes nothing');
});

test('without any survey a fullstack plan still orders backend.implement behind interface.draw', () => {
  const p = plan('build the wishlist feature backend and frontend');
  assert.ok(hasEdge(p, 'interface.draw', 'backend.implement'));
});
