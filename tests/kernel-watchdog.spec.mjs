import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAgentScreen } from '../scripts/kernel/terminal-liveness.mjs';
import { buildWakePrompt } from '../scripts/kernel/watchdog.mjs';

test('provider input prompt is turn-idle even when it carries an Orca message',()=>{
  const screen=`Worked for 18m 4s · done 6:56 AM
─ Conversation recap ─
› You have 4 orchestration messages. Run the canonical check.`;
  assert.equal(classifyAgentScreen(screen).state,'turn-idle');
});

test('current activity wins over the provider input row kept visible by the TUI',()=>{
  const screen=`• Ran canonical status
• Working (4m 36s · esc to interrupt) · 1 background terminal running
› Ask Codex to do anything`;
  assert.equal(classifyAgentScreen(screen).state,'active');
});

test('quoted child activity does not strand a turn-idle Kernel',()=>{
  const screen=` │ • Working (28s · esc to interrupt) · Running hook
 │ › Ask Codex to do anything
 └ Exited with code 0
Seam worker filed its report; the Kernel must consume it.
› Ask Devin to build features, fix bugs, or work on your code`;
  assert.equal(classifyAgentScreen(screen).state,'turn-idle');
});

test('permission and process failures are not treated as safe wake prompts',()=>{
  assert.equal(classifyAgentScreen('1 Yes (Approve once)\n2 No\nconfirm · esc Cancel').state,'interactive-gate');
  assert.equal(classifyAgentScreen('ERROR: Not logged in\n› Ask Codex to do anything').state,'failed');
});

test('watchdog wake transfers cadence ownership outside the Kernel model turn',()=>{
  const prompt=buildWakePrompt('wf-example');
  assert.match(prompt,/external watchdog owns the 5-minute cadence/i);
  assert.match(prompt,/yield the model turn immediately/i);
  assert.match(prompt,/Never run Start-Sleep/i);
  assert.doesNotMatch(prompt,/poll canonical status again/i);
  assert.doesNotMatch(prompt,/Do not yield/i);
});

test('watchdog wakes a turn-idle Kernel only when status says the frontier is actionable',()=>{
  const src=fs.readFileSync(new URL('../scripts/kernel/watchdog.mjs',import.meta.url),'utf8');
  const idle=src.indexOf("classified.state === 'turn-idle'"),gate=src.indexOf('frontier?.actionable',idle),send=src.indexOf('terminalSend(',idle);
  assert.ok(idle>0&&gate>idle&&send>gate,'the actionable gate sits between the turn-idle branch and the wake send');
  assert.match(src,/action: 'idle-waiting'/);
  const supervise=fs.readFileSync(new URL('../modules/supervisor/supervise.yaml',import.meta.url),'utf8');
  assert.match(supervise,/watchdog\.mjs --repo <repo> --workflow <id> --repair/,'the recovery recipe spawns a watchdog that can wake');
});
