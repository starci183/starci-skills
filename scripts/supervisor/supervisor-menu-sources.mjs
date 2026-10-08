// supervisor-menu-sources.mjs — reads what the Supervisor's menu is built from: the live Decision Items it decides in machine.sqlite,
// each with the product ledger it concerns. Read-only; `starci supervisor status` and `starci supervisor decide` call it.
import { readSupervisor } from '../machine/home.mjs';
import { supervisorDecisions } from '../machine/decisions.mjs';
import { buildSupervisorMenu } from './supervisor-menu.mjs';

const ledgerOf = (m, di) => {
  try {
    if (di.refs?.ledgerId) return m.resolveLedger({ ledgerId: String(di.refs.ledgerId) });
    return di.productLedger ? m.resolveLedger({ name: String(di.productLedger) }) : null;
  } catch { return null; }
};

/** The live Decision Items the Supervisor decides, each {di, ledger}, over a machine handle. */
const supervisorItems = (m, { now = Date.now() } = {}) => supervisorDecisions(m, { now }).filter((di) => di.decider === 'supervisor')
  .map((di) => ({ di, ledger: ledgerOf(m, di) }));

/** The current menu; an absent machine store is an empty menu. */
export const readSupervisorMenu = ({ env = process.env, now = Date.now() } = {}) => readSupervisor((m) => buildSupervisorMenu(supervisorItems(m, { now })), [], { env });
