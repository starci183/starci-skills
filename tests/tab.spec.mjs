import test from 'node:test';
import assert from 'node:assert/strict';
import {TAB_VERDICTS,TAB_WINDOW,classifyTab,contractTrace} from '../kernel/tab.mjs';

/**
 * The classifier over real frames. Every fixture below is what one of the four agents actually draws, because
 * the whole point of the module is that a rendered frame - not a liveness word - says which of five things is
 * happening in a tab the probe called `stalled-idle`.
 */

const CLAUDE_WORKING=[
  '● Bash(npm run test:unit)',
  '  ⎿  Running…',
  '⠧ Report task outcome',
  '  Read 1 file, listed 3 directories, ran 9 shell commands',
  '✳ Cogitated for 4m 4s · done 1:01 PM',
  '',
  '❯',
  '  ⏵⏵ bypass permissions on'];

const CLAUDE_PERMISSION=[
  '● Edit(apps/agentos-controlplane/src/sales/intake.ts)',
  '',
  'Do you want to make this edit to intake.ts?',
  '❯ 1. Yes',
  '  2. Yes, and don\'t ask again this session',
  '  3. No, and tell Claude what to do differently'];

const CLAUDE_QUESTION=[
  '● I found two ways to wire the webhook: a polling loop, or the update stream.',
  '● Should I proceed with option 2?',
  '',
  '❯'];

const CLAUDE_FINISHED=[
  '● I updated the intake module and the unit tests pass.',
  '  node L.mjs report --run run_wf --outcome done',
  '  Error: Cannot find module \'L.mjs\'',
  '',
  '❯'];

const CODEX_BANNER=[
  '>_ OpenAI Codex (v0.20.0)',
  '   model: gpt-5.6-sol',
  '   directory: D:/repo/nivo-backend',
  '▌ Ask Codex anything'];

const CODEX_WITH_CONTRACT=[
  '>_ OpenAI Codex (v0.20.0)',
  '   model: gpt-5.6-sol',
  '=== TASK ===',
  'Task id: task_7 - read .starciwork/_local/runtime/contracts/op-intake.md completely',
  '● Opening the contract now.',
  '❯'];

const verdict=(lines,op={})=>classifyTab({lines,op}).verdict;

test('a Claude tab still drawing a turn is working, whatever the liveness probe called it',()=>{
  const read=classifyTab({lines:CLAUDE_WORKING,op:{id:'op-intake'}});
  assert.equal(read.verdict,'working');
  assert.match(read.line,/⠧|Read 1 file/);
});

test('a permission prompt on screen is a question, and a mechanical one',()=>{
  const read=classifyTab({lines:CLAUDE_PERMISSION,op:{id:'op-intake'}});
  assert.equal(read.verdict,'asked');
  assert.equal(read.kind,'mechanical');
  assert.match(read.text,/Do you want to make this edit/);
});

test('a turn that ended on a question to the user is an ask nobody wrote down',()=>{
  const read=classifyTab({lines:CLAUDE_QUESTION,op:{id:'op-intake'}});
  assert.equal(read.verdict,'asked');
  assert.equal(read.kind,'decision');
  assert.equal(read.text,'Should I proceed with option 2?');
});

test('a turn that ended - a report command that errored - with no report file is finished-unreported',()=>{
  const read=classifyTab({lines:CLAUDE_FINISHED,op:{id:'op-intake'}});
  assert.equal(read.verdict,'finished-unreported');
  assert.match(read.text,/Cannot find module/);
  assert.match(read.text,/I updated the intake module/,'the last words are what the next attempt is given');
});

test('an empty tab and an agent banner with no trace of the contract are both prompt-missing',()=>{
  assert.equal(verdict([]),'prompt-missing');
  assert.equal(verdict(['','   ','']),'prompt-missing');
  assert.equal(verdict(CODEX_BANNER,{id:'op-intake',dispatch:'ctx_9'}),'prompt-missing');
});

test('the same banner with the contract on it is idle, not a launch that failed',()=>{
  const read=classifyTab({lines:CODEX_WITH_CONTRACT,op:{id:'op-intake',task:'task_7'}});
  assert.equal(read.verdict,'idle');
});

test('the contract trace is the preamble, the Task, the Dispatch or the operation own id',()=>{
  assert.equal(contractTrace(CODEX_BANNER,{id:'op-intake',dispatch:'ctx_9'}),false);
  assert.equal(contractTrace(CODEX_WITH_CONTRACT,{id:'op-intake'}),true);
  assert.equal(contractTrace(['nothing here','at all'],{id:'op-intake'}),false);
  assert.equal(contractTrace(['starting op-intake now'],{id:'op-intake'}),true);
  assert.equal(contractTrace(['Dispatch ctx_9 accepted'],{}),true);
});

test('a finished turn is read from the end, so scrollback further back than the window never decides it',()=>{
  const filler=Array.from({length:TAB_WINDOW+10},(_,index)=>`● step ${index}`);
  assert.equal(verdict([...filler,'✳ Cogitated for 2m 1s · done 4:02 PM','❯'],{id:'op-intake'}),'finished-unreported');
  assert.equal(verdict(['✳ Cogitated for 2m 1s · done 4:02 PM',...filler],{id:'op-intake'}),'idle',
    'a done line the agent has since scrolled past is not the end of a turn');
});

test('every verdict the classifier can return is in the closed set',()=>{
  for(const lines of [[],CLAUDE_WORKING,CLAUDE_PERMISSION,CLAUDE_QUESTION,CLAUDE_FINISHED,CODEX_BANNER,CODEX_WITH_CONTRACT])
    assert.ok(TAB_VERDICTS.includes(verdict(lines,{id:'op-intake'})));
});
