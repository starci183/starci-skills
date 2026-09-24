import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../engine/yaml.mjs';
import {classifyAgentScreen,cardLivenessPatterns} from '../scripts/kernel/terminal-liveness.mjs';

// sn-learn-content Kernel term_2cd5a276, 2026-09-25: Claude Code drew its auto-update notice between a live
// spinner and the ❯ input box, the notice read as a finished answer, and the running Kernel read turn-idle.
// Frames below are rows captured read-only from the live terminals that morning (claude CLI 2.1.281/2.1.282):
// sn-learn-content term_2cd5a276, nivo term_e5c715f9 and term_7cf0a1ec, sn term_04016f5e. Other notice texts
// are the 2.1.282 binary's own strings (the updater, IDE and MCP notices).

const ROOT=path.resolve(import.meta.dirname,'..');
const RULE='────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────';
const CHROME=[RULE,'❯',RULE,'  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const SPINNER='* Caramelizing… (1m 25s · ↓ 2.4k tokens)';
const EXE_IN_USE='     ✘ Auto-update failed: claude.exe in use (close other Claude Code sessions, including VS Code) · Run claude doctor';
const EXE_IN_USE_TRUNCATED='  ✘ Auto-update failed: claude.exe in use (close other Claude Code …';
const INSTALLED='                               ✔ Update installed · Restart to apply';
const frame=(...rows)=>[...rows,...CHROME].join('\n');
const both=(screen)=>[classifyAgentScreen(screen).state,classifyAgentScreen(screen,{provider:'claude'}).state];

test('the Claude card declares its notice rows as chrome, and every pattern compiles', () => {
  const declared=parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','agents','claude.yaml'),'utf8')).liveness.chromePatterns;
  assert.ok(declared.length>=6,'the effort row plus the updater, doctor-hint, IDE, selection and MCP notices');
  assert.equal(cardLivenessPatterns({refresh:true}).get('claude').chrome.length,declared.length);
});

test('a live spinner above "✘ Auto-update failed: claude.exe in use" reads active (sn-learn-content term_2cd5a276)', () => {
  const answer=['  Status: engaged / actionable: false. The draw seam op-interface.draw-dc99cc7b8f is running and hasn\'t filed a report'];
  assert.deepEqual(both(frame(...answer,SPINNER,EXE_IN_USE)),['active','active'],'was turn-idle: the notice read as a finished answer');
  assert.deepEqual(both(frame(...answer,SPINNER,EXE_IN_USE_TRUNCATED)),['active','active'],'the notice truncated to a narrow terminal (nivo term_7cf0a1ec)');
  assert.deepEqual(both(frame(...answer,SPINNER,INSTALLED)),['active','active'],'"✔ Update installed · Restart to apply" (sn term_04016f5e)');
});

test('the captured nivo frame with a Tip row and the notice under the spinner stays active (term_e5c715f9)', () => {
  const nivo=frame('     op-backend.implement-5faa41304b --verdict fail 2>/dev/null | cut -c1-500; echo "exit ${PIPESTATUS[0]}" (3s)',
    '     (ctrl+b to run in background)',SPINNER,
    '  ⎿  Tip: Use /btw to ask a quick side question without interrupting Claude\'s current work',
    '         ✘ Auto-update failed: claude.exe in use (close other Claude Code sessions, including VS Code) · Run claude doctor');
  assert.deepEqual(both(nivo),['active','active']);
  // Without the long Tip row above it, the notice was no longer read as the Tip's wrapped tail.
  assert.deepEqual(both(frame(SPINNER,'         ✘ Auto-update failed: claude.exe in use (close other Claude Code sessions, including VS Code) · Run claude doctor')),['active','active']);
});

test('every Claude Code 2.1.282 notice row under a live spinner reads active', () => {
  const notices=[
    '  ✗ Auto-update failed · Try claude doctor or npm i -g @anthropic-ai/claude-code',
    '  ✘ Auto-update failed: no write permission to npm prefix · Run claude doctor',
    '  ✘ Auto-update failed · Run claude doctor',
    '  Auto-updating…',
    '  ✔ Update installed · Restart to update',
    '  Update available! Run: npm i -g @anthropic-ai/claude-code',
    '  Claude Code can\'t auto-update · run `claude doctor`',
    '  globalVersion: 2.1.282 · latestVersion: 2.1.283',
    '  Visual Studio Code disconnected',
    '  IDE extension install failed (see /status for info)',
    '  ⧉ In src/modules/learn/learn.service.ts',
    '  ⧉ 3 lines selected',
    '  MCP 2 servers blocked by enterprise policy: jira, drive',
    '  your MCP server choices apply to this session only (workspace not explicitly trusted; .claude/settings.local.json is gated) · to persist, add them to enabledMcpjsonServers in ~/.claude/settings.json',
  ];
  for (const notice of notices) assert.deepEqual(both(frame('● Reading the frontier.',SPINNER,notice)),['active','active'],notice);
  // The two-row restore failure: its second row names the preserved copy.
  assert.deepEqual(both(frame(SPINNER,
    '  ✘ Update failed and C:\\Users\\Hi\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe could not be restored — it was preserved at:',
    '  C:\\Users\\Hi\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe.old.1790280018689 · rename it back to claude.exe or run npm i -g @anthropic-ai/claude-code')),['active','active']);
  // Stacked notices, as a session that has both an updater and an IDE notice draws them.
  assert.deepEqual(both(frame(SPINNER,EXE_IN_USE,'  Visual Studio Code disconnected')),['active','active']);
});

test('a finished turn above a notice row still reads turn-idle, and prose about the updater is an answer', () => {
  // The four idle frames captured live that morning.
  assert.deepEqual(both(frame('  report, and no peer messages are pending. I\'m yielding until it reports or the watchdog wakes me.','✻ Baked for 33s · done 5:23 AM',EXE_IN_USE)),['turn-idle','turn-idle']);
  assert.deepEqual(both(frame('  repair op-interface.implement-2a43f63c6c is still running.','✻ Cooked for 34s · done 5:30 AM',EXE_IN_USE_TRUNCATED)),['turn-idle','turn-idle']);
  assert.deepEqual(both(frame('  lượt, chờ report của job draw.','✻ Worked for 1m 5s · done 5:24 AM',INSTALLED)),['turn-idle','turn-idle']);
  assert.deepEqual(both(frame('  report của hai job này.','✻ Churned for 11s · done 5:29 AM',INSTALLED)),['turn-idle','turn-idle']);
  // A finished answer below the spinner ends the turn whatever notice follows it.
  assert.deepEqual(both(frame(SPINNER,'● Report filed with outcome done.',EXE_IN_USE)),['turn-idle','turn-idle']);
  // The notice's words in an answer are the answer: a bullet row, and a claude doctor mention without the " · Run" hint.
  assert.deepEqual(both(frame(SPINNER,'● Auto-update failed on this host; claude.exe is held by other sessions.')),['turn-idle','turn-idle']);
  assert.deepEqual(both(frame(SPINNER,'  I ran claude doctor and it reported no problem.')),['turn-idle','turn-idle']);
  assert.deepEqual(both(frame(SPINNER,'  Cursor disconnected users are not a concern of this workflow.')),['turn-idle','turn-idle']);
});
