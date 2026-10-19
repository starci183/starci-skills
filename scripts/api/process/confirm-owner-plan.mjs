// Native interactive confirmation; arguments and redirected input cannot accept a plan.
import { createInterface } from 'node:readline/promises';

/**
 * Display the frozen public plan and require its full digest from a real interactive terminal.
 * This is an owner checkpoint, not caller authentication; the caller separately checks native role.
 * Noninteractive execution refuses before opening a reader and never accepts a flag as an answer.
 */
export async function confirmOwnerPlan({ plan, digest }, { input = process.stdin, output = process.stdout } = {}) {
  if (input.isTTY !== true || output.isTTY !== true || !/^[a-f0-9]{64}$/u.test(digest ?? ''))
    return { accepted: false, code: 'owner-terminal-required' };
  output.write(`\n${JSON.stringify(plan, null, 2)}\n\nPlan digest: ${digest}\n`);
  const terminal = createInterface({ input, output });
  try {
    const answer = await terminal.question(`Type accept ${digest} to authorize only this plan: `);
    return answer.trim() === `accept ${digest}`
      ? { accepted: true, code: 'owner-plan-accepted' }
      : { accepted: false, code: 'owner-plan-not-accepted' };
  } finally { terminal.close(); }
}
