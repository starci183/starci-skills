// supervisor-menu-sources.mjs — reads what the Supervisor's menu is built from: the live Decision Items it decides in machine.sqlite,
// each with the product ledger it concerns. Read-only; `starci supervisor status` and `starci supervisor decide` call it.
import { readSupervisor } from '../machine/home.mjs';
import { supervisorDecisions } from '../machine/decisions.mjs';
import { buildSupervisorMenu } from './supervisor-menu.mjs';

/** The product ledger a Decision Item concerns: refs.ledgerId (the planners write the ledger's name there, the registry keys it by id), else its productLedger. */
const ledgerOf = (m, di) => {
  const tries = [di.refs?.ledgerId && { ledgerId: String(di.refs.ledgerId) }, di.refs?.ledgerId && { name: String(di.refs.ledgerId) }, di.productLedger && { name: String(di.productLedger) }].filter(Boolean);
  for (const key of tries) {
    try { const found = m.resolveLedger(key); if (found) return found; } catch { /* the next key */ }
  }
  return null;
};

/** The live Decision Items the Supervisor decides, each {di, ledger}, over a machine handle. */
const supervisorItems = (m, { now = Date.now() } = {}) => supervisorDecisions(m, { now }).filter((di) => di.decider === 'supervisor')
  .map((di) => ({ di, ledger: ledgerOf(m, di) }));

/** The current menu; an absent machine store is an empty menu. */
export const readSupervisorMenu = ({ env = process.env, now = Date.now() } = {}) => readSupervisor((m) => buildSupervisorMenu(supervisorItems(m, { now })), [], { env });
