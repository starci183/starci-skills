import test from 'node:test';
import assert from 'node:assert/strict';
import {PROVIDER_FAMILIES,SCAN_ORDER,SCREENS,detect,detectFromTitle,observe,rateLimitSignal} from '../hosts/orca/observe.mjs';

const term=(extra={})=>({handle:'t',status:'running',lastOutputAt:1000,title:'[Op] backend.implement - Sales',...extra});
const at=(screen,extra={})=>observe({screen,terminal:term(extra.terminal),now:2000,...extra});

// One realistic tail per family and phase: the text the provider actually renders, footer included.
const CLAUDE={
  busy:'● Editing apps/sales/intake.ts\n  ⏵⏵ bypass permissions on · esc to interrupt',
  // The status line of a turn past its first minute, exactly as the r2 trial's worker drew it before the probe
  // called it idle: no hint bar, a Tip line, the footer still on screen.
  busyLong:'"DEC-ACC-UNKNOWN\\|unknown-recovery" .starciwork/features/shared-lifecycle/\n✢ Gitifying… (7m 9s · ↓ 22.9k tokens · thinking)\nTip: Use /btw to ask a quick side question without interrupting Claude\'s\ncurrent work\n  ⏵⏵ bypass permissions on',
  busyShort:'● Read(.starciwork/features/login/business/index.yaml)\n✶ Combobulating… (42s · ↑ 1.2k tokens)\n  ⏵⏵ bypass permissions on',
  idle:'✻ Done (1:21 PM)\n❯\n  ⏵⏵ bypass permissions on',
  prompt:'Do you want to proceed?\n❯ 1. Yes\n  2. No, tell Claude what to do differently\n  ⏵⏵ bypass permissions on'
};
const CODEX={
  busy:'› Ask Codex to do something\nWorking (12s · esc to interrupt)',
  idle:'› Ask Codex to do something\n  OpenAI Codex v0.40.0',
  prompt:'Allow command `npm test`? (y/n)'
};
const QWEN={
  busy:'⠦ Herding digital cats... (14s · esc to cancel)\nqwen3.8-flash (Token Plan Singapore)',
  idle:'*   Type your message or @path/to/file\nqwen3.8-flash (Token Plan Singapore)',
  prompt:'Allow execution of: orca?\n› 1. Yes, allow once\n⠏ Waiting for user confirmation...'
};
const DEVIN={
  busy:'Devin CLI\nWorking... (esc to interrupt)',
  idle:'Devin CLI\nMessage Devin',
  prompt:'Devin CLI\nDo you want to run npm test? (y/n)'
};
const SHELL={idle:'npm run build\n\nPS D:\\Repositories\\sales>',prompt:'Overwrite apps/sales/intake.ts? [y/N]'};

test('a family is named by its own footer, and a canonical title names it when the footer is off screen',()=>{
  assert.deepEqual(PROVIDER_FAMILIES,['claude','codex','qwen','devin','shell']);
  assert.deepEqual(SCAN_ORDER,['claude','codex','qwen','devin']);
  assert.equal(detect(CLAUDE.busy),'claude');
  assert.equal(detect(CLAUDE.idle),'claude');
  assert.equal(detect(CODEX.idle),'codex');
  assert.equal(detect(CODEX.busy),'codex');
  assert.equal(detect(QWEN.busy),'qwen');
  assert.equal(detect(QWEN.idle),'qwen');
  assert.equal(detect(DEVIN.idle),'devin');
  // A screen that says nothing about its agent claims no family; a tail array is the same text as a string.
  assert.equal(detect('Reading files...'),null);
  assert.equal(detect(['*   Type your message or @path','qwen3.8-flash']),'qwen');
  assert.equal(detectFromTitle('✳ Qwen - sales'),'qwen');
  assert.equal(detectFromTitle('Report task outcome'),'codex');
  assert.equal(detectFromTitle('Codex - [Op] backend.implement'),'codex');
  assert.equal(detectFromTitle('Claude Code - sales'),'claude');
  assert.equal(detectFromTitle('Devin - sales'),'devin');
  assert.equal(detectFromTitle('PowerShell - sales'),'shell');
  assert.equal(detectFromTitle('[Op] backend.implement - Sales'),null);
  assert.equal(detectFromTitle(''),null);
});

test('a Claude turn past its first minute is working, and the footer alone never makes a screen idle',()=>{
  for(const screen of [CLAUDE.busyLong,CLAUDE.busyShort]){
    const verdict=observe({screen,terminal:term(),now:2000,provider:'claude'});
    assert.deepEqual([verdict.liveness,verdict.provider],['working','claude'],screen.slice(0,40));
    assert.equal(at(screen).liveness,'working','the detector names Claude from the footer and still reads the status line');
  }
  // Footer with nothing else: not idle. It falls through to the silence rule, and recent output is working.
  assert.equal(observe({screen:'● Editing apps/sales/intake.ts\n  ⏵⏵ bypass permissions on',terminal:term(),now:2000,provider:'claude'}).liveness,'working');
  assert.equal(observe({screen:'● Editing apps/sales/intake.ts\n  ⏵⏵ bypass permissions on',terminal:term({lastOutputAt:1000}),now:1000+21*60*1000,provider:'claude'}).liveness,'stalled-silent');
  assert.equal(observe({screen:CLAUDE.idle,terminal:term(),now:2000,provider:'claude'}).liveness,'stalled-idle','the prompt box still says idle');
});

test('every family classifies its own busy, idle and confirmation screens and accepts with its own keystroke',()=>{
  for(const [family,screens] of [['claude',CLAUDE],['codex',CODEX],['qwen',QWEN],['devin',DEVIN],['shell',SHELL]]){
    const answer=SCREENS[family].answer;
    for(const [phase,liveness] of [['busy','working'],['idle','stalled-idle'],['prompt','stalled-prompt']]){
      if(!screens[phase])continue;
      // The family is passed explicitly here: the table, not the detector, is what is under test.
      const verdict=observe({screen:screens[phase],terminal:term(),now:2000,provider:family});
      assert.deepEqual([verdict.liveness,verdict.provider,verdict.answer],[liveness,family,answer],`${family} ${phase}`);
    }
  }
  assert.deepEqual([SCREENS.claude.answer,SCREENS.codex.answer,SCREENS.qwen.answer,SCREENS.devin.answer,SCREENS.shell.answer],['1','y','1','y','y']);
});

test('an untitled screen is scanned over the agent families, prompt before busy before idle',()=>{
  // Claude and Codex share `esc to interrupt`; Qwen and a shell share `(y/n)`. The scan order settles who owns
  // a screen, and the phase order settles that a dialog is never read as work or as an idle prompt.
  assert.deepEqual([at(CLAUDE.busy).liveness,at(CLAUDE.busy).provider],['working','claude']);
  assert.deepEqual([at(CLAUDE.prompt).liveness,at(CLAUDE.prompt).answer],['stalled-prompt','1']);
  assert.deepEqual([at(CODEX.prompt).liveness,at(CODEX.prompt).provider,at(CODEX.prompt).answer],['stalled-prompt','codex','y']);
  assert.deepEqual([at(QWEN.prompt).liveness,at(QWEN.prompt).provider,at(QWEN.prompt).answer],['stalled-prompt','qwen','1']);
  assert.deepEqual([at(QWEN.busy).liveness,at(QWEN.busy).provider],['working','qwen']);
  assert.deepEqual([at(QWEN.idle).liveness,at(QWEN.idle).provider],['stalled-idle','qwen']);
  // The screen outranks the title, because a title survives the agent that was renamed under it.
  assert.equal(at(CODEX.idle,{terminal:{...term(),title:'✳ Qwen - sales'}}).provider,'codex');
  assert.equal(at(QWEN.idle,{terminal:{...term(),title:'Report task outcome'}}).provider,'qwen');
  // A shell is never guessed: its signatures are a prompt character and a (y/n) tail, so it must be selected.
  assert.equal(at(SHELL.idle).liveness,'working');
  assert.equal(at(SHELL.idle).provider,null);
  assert.equal(at(SHELL.idle,{terminal:{...term(),title:'PowerShell - sales'}}).liveness,'stalled-idle');
  assert.equal(at(SHELL.prompt,{provider:'shell'}).answer,'y');
  // An unknown provider name falls back to the scan instead of throwing on a missing table row.
  assert.equal(at(QWEN.busy,{provider:'gemini'}).provider,'qwen');
});

test('a quota refusal is read off the screen before any liveness rule, so the kernel can park the runtime',()=>{
  assert.deepEqual(rateLimitSignal('API Error: 429 {"type":"rate_limit_error"}').kind,'http-429');
  assert.equal(rateLimitSignal('Error: overloaded_error, please try again').kind,'overloaded');
  const capacity='Selected model is at capacity. Please try a different model.';
  assert.equal(rateLimitSignal(`${capacity}\n${CODEX.idle}`).kind,'overloaded');
  assert.equal(observe({screen:`${capacity}\n${CODEX.idle}`,terminal:term(),now:2000,provider:'codex'}).liveness,'rate-limited');
  assert.equal(rateLimitSignal(`The prior terminal printed "${capacity}" before recovery.`),null,'quoted historical prose is not a current provider refusal');
  assert.equal(rateLimitSignal(`${capacity}\n${CODEX.busy}`),null,'newer active provider output supersedes retained refusal scrollback');
  assert.equal(rateLimitSignal('You have exceeded your current quota').kind,'quota');
  assert.equal(rateLimitSignal('Rate limit reached for this model; retry after 60s').kind,'rate-limit');
  assert.equal(rateLimitSignal('Your credit balance is too low').kind,'quota');
  assert.equal(rateLimitSignal(CLAUDE.busy),null);
  assert.equal(rateLimitSignal(''),null);
  // Words are not refusals: a commerce contract talks about billing and quota, a design about rate-limit rules.
  for(const prose of ['- purchase, payment, billing and entitlement journeys','the plan quota per workspace is a business rule','Reconcile the rate-limit policy of the chatbot feature','● Read(.starciwork/features/agentos-commerce/business/srs/billing/index.yaml)'])
    assert.equal(rateLimitSignal(prose),null,prose);
  assert.equal(rateLimitSignal('API Error: 429 {"type":"rate_limit_error","message":"This request would exceed your account\'s rate limit"}').kind,'http-429');
  assert.equal(rateLimitSignal("You've hit your usage limit · resets 3pm").kind,'quota');
  assert.equal(observe({screen:'⎿ API Error: 429 rate_limit_error · max retries reached\n❯\n  ⏵⏵ bypass permissions on',terminal:term(),now:2000,provider:'claude'}).liveness,'rate-limited');
  assert.equal(observe({screen:'● The billing journey covers plan quota, invoices and refunds.\n❯\n  ⏵⏵ bypass permissions on',terminal:term(),now:2000,provider:'claude'}).liveness,'stalled-idle','prose about billing at an idle prompt is idle, not refused');
  // Busy text on the same screen does not hide the refusal; the family still comes back for the retry route.
  const limited=at(`${CLAUDE.busy}\nAPI Error: 429 rate_limit_error`);
  assert.equal(limited.liveness,'rate-limited');
  assert.equal(limited.provider,'claude');
  assert.match(limited.reason,/http-429/);
  assert.equal(at(`${QWEN.idle}\noverloaded_error`).liveness,'rate-limited');
});

test('facts outrank screen text: a listed-dead terminal and a written report are not read off the screen',()=>{
  assert.equal(at(QWEN.busy,{terminal:null}).liveness,'dead');
  assert.equal(at(QWEN.busy,{terminal:{...term(),status:'exited'}}).liveness,'dead');
  assert.equal(at(QWEN.busy,{terminal:{...term(),status:'closed'}}).reason,'terminal closed');
  // A report is the end of the operation, so a stale refusal or dialog on the screen no longer decides.
  assert.equal(at(`${QWEN.prompt}\nAPI Error: 429`,{reported:true}).liveness,'reported');
  // Silence is the last rule, and only for a screen no family claims.
  assert.equal(observe({screen:'Reading files...',terminal:term(),now:1000+30*60*1000,stalledAfterMs:20*60*1000}).liveness,'stalled-silent');
  assert.equal(observe({screen:'Reading files...',terminal:term(),now:1000+30*60*1000,stalledAfterMs:20*60*1000}).provider,null);
  assert.equal(observe({screen:QWEN.busy,terminal:term(),now:1000+30*60*1000,stalledAfterMs:20*60*1000}).liveness,'working');
  assert.equal(at('Reading files...').reason,'recent output');
});
