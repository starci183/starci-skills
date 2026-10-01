import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAgentScreen} from '../../scripts/lib/terminal-liveness.mjs';

// A provider screen that waits for a human answer (Codex directory trust, Claude Code first-run setup) is the
// liveness classifier's interactive-gate with the gate's name (a live worker's screen; the launch itself is
// orchestration worker-start). The runtime only names the gate; answering it is the owner's decision.

// Exact screens observed from a real launch.
const CODEX_TRUST="You are in D:\\Repositories\\ecommerce-app  Do you trust the contents of this directory? Working with untrusted contents comes with higher risk of prompt injection. Trusting the directory allows project-local config, hooks, and exec policies to load. › 1. Yes, continue 2. No, quit  Press enter to continue";
const CLAUDE_ONBOARDING="Let's get started. Choose the text style that looks best with your terminal To change this later, run /theme 1. Auto (match terminal) ❯ 2. Dark mode ✔";

test('the Codex trust prompt and the Claude Code onboarding are interactive gates with named reasons',()=>{
  assert.deepEqual([classifyAgentScreen(CODEX_TRUST).state,classifyAgentScreen(CODEX_TRUST).gate],['interactive-gate','codex-directory-trust']);
  assert.deepEqual([classifyAgentScreen(CLAUDE_ONBOARDING).state,classifyAgentScreen(CLAUDE_ONBOARDING).gate],['interactive-gate','claude-first-run-onboarding']);
  const lines=CODEX_TRUST.replace('? ','?\n').replace(' › ','\n› ').replace(' 2. ','\n  2. ');
  assert.equal(classifyAgentScreen(lines).gate,'codex-directory-trust','the gate wins over the `›` prompt row');
  assert.equal(classifyAgentScreen('1 Yes (Approve once)\n2 No\nconfirm · esc Cancel').gate,'tool-approval');
});

