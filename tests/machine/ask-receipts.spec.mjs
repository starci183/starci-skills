import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { commitAskAnswer } from '../../scripts/machine/ask-receipts.mjs';

const workflowId = 'wf-atomic-answer', dispatchId = 'ctx-atomic-answer';
const receipt = option => ({ schema: 'starci/ask-answer@1', workflowId, dispatchId, opId: 'decision.prepare', answeredBy: 'owner', option, optionIndex: option === 'a' ? 0 : 1, note: null, at: new Date().toISOString() });
const counts = ledger => Object.fromEntries(['decisions', 'job_artifacts', 'events'].map(table => [table, ledger.db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));

test('an answer event failure rolls back its receipt and decision together', async t => {
  await withLedger(t, ({ ledger }) => {
    seedWorkflow(ledger, { id: workflowId });
    const before = counts(ledger);
    const append = ledger.appendEvent;
    ledger.appendEvent = () => { throw new Error('fixture failed at answer event'); };
    try { assert.throws(() => commitAskAnswer(ledger, { workflowId, dispatchId, receipt: receipt('a') }), /fixture failed/); }
    finally { ledger.appendEvent = append; }
    assert.deepEqual(counts(ledger), before);
    assert.equal(commitAskAnswer(ledger, { workflowId, dispatchId, receipt: receipt('a') }).accepted, true);
  });
});

test('an identical retry returns the committed receipt and a contradictory answer cannot create another decision', async t => {
  await withLedger(t, ({ ledger }) => {
    seedWorkflow(ledger, { id: workflowId });
    const answer = receipt('a');
    const first = commitAskAnswer(ledger, { workflowId, dispatchId, receipt: answer });
    const before = counts(ledger);
    const retry = commitAskAnswer(ledger, { workflowId, dispatchId, receipt: { ...answer, at: new Date(Date.now() + 5).toISOString() } });
    assert.equal(retry.replayed, true);
    assert.equal(retry.receiptSha, first.receiptSha);
    ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-serving', payload: { dispatchId } });
    const afterServing = counts(ledger);
    assert.equal(commitAskAnswer(ledger, { workflowId, dispatchId, receipt: receipt('b') }).accepted, false);
    assert.deepEqual(counts(ledger), afterServing);
    assert.equal(afterServing.decisions, before.decisions);
  });
});

test('two independent processes can commit only one contradictory logical answer', async t => {
  await withLedger(t, async ({ root, ledger, ledgerFile }) => {
    seedWorkflow(ledger, { id: workflowId });
    const script = path.join(root, 'competing-answer.mjs');
    const ledgerModule = pathToFileURL(path.resolve(import.meta.dirname, '../../engine/db/ledger.mjs')).href;
    const receiptModule = pathToFileURL(path.resolve(import.meta.dirname, '../../scripts/machine/ask-receipts.mjs')).href;
    fs.writeFileSync(script, `import {openLedger} from ${JSON.stringify(ledgerModule)}; import {commitAskAnswer} from ${JSON.stringify(receiptModule)};
      const ledger=openLedger({file:process.argv[2]});try{console.log(JSON.stringify(commitAskAnswer(ledger,{workflowId:${JSON.stringify(workflowId)},dispatchId:${JSON.stringify(dispatchId)},receipt:JSON.parse(process.argv[3])})));}finally{ledger.close();}`);
    const run = option => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, ledgerFile, JSON.stringify(receipt(option))], { env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = ''; child.stdout.on('data', data => out += data); child.stderr.on('data', data => err += data);
      child.once('error', reject); child.once('close', code => { if (code !== 0) reject(new Error(err)); else resolve(JSON.parse(out)); });
    });
    const results = await Promise.all([run('a'), run('b')]);
    assert.equal(results.filter(result => result.accepted).length, 1);
    assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='ask-answered'").get().n, 1);
    assert.equal(ledger.db.prepare('SELECT count(*) n FROM decisions').get().n, 1);
  });
});
