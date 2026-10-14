// R269: app repositories in both editions declare dependency updates, a production audit gate, and image SBOM/provenance.
import { parseWorkflow } from '../runtime-rules/workflow-source.mjs';
import { found, readText } from './read.mjs';

const DEPENDABOT = '.github/dependabot.yml';
const CI = '.github/workflows/ci.yml';
const IMAGES = '.github/workflows/images.yml';
const ECOSYSTEMS = ['npm', 'github-actions', 'docker'];
const enabled = (entry) => entry && (entry.if === undefined || entry.if === true || entry.if === 'true') && !entry['continue-on-error'];

function shellSeparator(line, index, quote) {
  if (quote) return null;
  if (line[index] === ';') return ';';
  const pair = line.slice(index, index + 2);
  return pair === '&&' || pair === '||' ? pair : null;
}

function isShellComment(line, index, quote) {
  return !quote && line[index] === '#' && (index === 0 || /\s/.test(line[index - 1]));
}

function shellQuote(char, quote) {
  if (char === quote) return null;
  return !quote && (char === '"' || char === "'") ? char : quote;
}

function appendShellCommand(commands, state, next) {
  const tokens = state.command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((token) => token.replace(/^["']|["']$/g, '')) ?? [];
  if (tokens.length) commands.push({ tokens, separator: state.separator, next });
  state.separator = next;
  state.command = '';
}

function shellLineCommands(line, commands) {
  const state = { quote: null, command: '', separator: null };
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '\\' && state.quote !== "'") {
      i++;
      state.command += char + (line[i] ?? '');
      continue;
    }
    if (isShellComment(line, i, state.quote)) break;
    const next = shellSeparator(line, i, state.quote);
    if (next) {
      appendShellCommand(commands, state, next);
      if (next.length === 2) i++;
      continue;
    }
    state.quote = shellQuote(char, state.quote);
    state.command += char;
  }
  appendShellCommand(commands, state, null);
}

/** Shell evidence is an executable command, never quoted text, a comment or a heredoc body. */
function shellCommands(run) {
  if (typeof run !== 'string') return [];
  const commands = [];
  let heredoc = null;
  for (const line of run.replace(/\\\r?\n/g, ' ').split(/\r?\n/)) {
    if (heredoc) {
      if (line.trim() === heredoc) heredoc = null;
      continue;
    }
    heredoc = /<<-?\s*['"]?(\w+)['"]?/.exec(line)?.[1] ?? null;
    shellLineCommands(line, commands);
  }
  return commands;
}

function executableCommands(run) {
  const commands = shellCommands(run);
  const uncheckedErrors = commands.some(({ tokens }) => tokens[0] === 'set' && tokens.includes('+e'));
  if (uncheckedErrors) return [];
  return commands.filter((command, index) => {
    if (command.separator === '||' || command.next === '||') return false;
    if (command.separator === '&&' && commands.slice(0, index).some(({ tokens }) => ['false', 'exit', 'return'].includes(tokens[0]))) return false;
    return !commands.slice(index + 1).some(({ tokens }) => tokens[0] === 'exit' && tokens[1] === '0');
  });
}

/** Only enabled jobs and steps can provide a supply-chain gate. Comments, labels and disabled steps are no evidence. */
function stepsOf(workflow) {
  return Object.values(workflow?.jobs ?? {}).filter(enabled).flatMap((job) => Array.isArray(job.steps) ? job.steps.filter(enabled) : []);
}

function hasDependabot(document) {
  const directory = (value) => typeof value === 'string' && value.startsWith('/');
  return document?.version === 2 && Array.isArray(document.updates) && ECOSYSTEMS.every((ecosystem) => document.updates.some((update) =>
    update?.['package-ecosystem'] === ecosystem &&
    (directory(update.directory) || Array.isArray(update.directories) && update.directories.length > 0 && update.directories.every(directory)) &&
    ['daily', 'weekly', 'monthly'].includes(update.schedule?.interval)));
}

function hasAudit(steps) {
  return steps.some((step) => executableCommands(step.run).some(({ tokens }) =>
    tokens[0] === 'npm' && tokens[1] === 'audit' &&
    (tokens.includes('--omit=dev') || tokens.some((token, index) => token === '--omit' && tokens[index + 1] === 'dev'))));
}

const asserted = (value) => value === true || value === 'true';
const provenanceEnabled = (value) => asserted(value) || typeof value === 'string' && /^mode=(?:min|max)$/.test(value);

function imageActionEvidence(step) {
  const action = step.uses ?? '';
  if (/^docker\/build-push-action@/.test(action)) {
    return { sbom: asserted(step.with?.sbom), provenance: provenanceEnabled(step.with?.provenance) };
  }
  return {
    sbom: /^actions\/attest-sbom@/.test(action) && Boolean(step.with?.['sbom-path']),
    provenance: /^actions\/attest-build-provenance@/.test(action) && Boolean(step.with?.['subject-path'] || step.with?.['subject-digest']),
  };
}

function attestationType(value, type) {
  return value === `type=${type}` || value?.startsWith(`type=${type},`) === true;
}

function hasAttestation(tokens, type) {
  return tokens.some((token, index) =>
    token.startsWith('--attest=') && attestationType(token.slice('--attest='.length), type) ||
    token === '--attest' && attestationType(tokens[index + 1], type));
}

function isSbomCommand(tokens) {
  if (tokens[0] === 'syft') {
    return tokens.length > 1 && !tokens.some((token) => ['--help', '--version', 'help', 'version'].includes(token));
  }
  return tokens[0] === 'docker' && tokens[1] === 'sbom' && tokens.length > 2 && !tokens.includes('--help');
}

function imageCommandEvidence(tokens) {
  if (tokens.slice(0, 3).join(' ') !== 'docker buildx build') return { sbom: isSbomCommand(tokens), provenance: false };
  return {
    sbom: tokens.includes('--sbom') || tokens.includes('--sbom=true') || hasAttestation(tokens, 'sbom'),
    provenance: tokens.some((token) => /^--provenance(?:=(?:true|mode=(?:min|max)))?$/.test(token)) || hasAttestation(tokens, 'provenance'),
  };
}

function imageEvidence(steps) {
  let sbom = false;
  let provenance = false;
  for (const step of steps) {
    const action = imageActionEvidence(step);
    sbom ||= action.sbom;
    provenance ||= action.provenance;
    for (const { tokens } of executableCommands(step.run)) {
      const command = imageCommandEvidence(tokens);
      sbom ||= command.sbom;
      provenance ||= command.provenance;
    }
  }
  return sbom && provenance;
}

/** Synchronous judge of R269 at the app root; root-wide gates run only when their paths are in scope. */
export function supplyChainFindings({ repoRoot, files, all = files, repo, isRoot, inScope = () => true }) {
  if (repo?.kind !== 'app' || !['lite', 'full'].includes(repo.edition) || isRoot === false) return [];
  const tracked = new Set(all);
  const parsed = (file) => tracked.has(file) ? parseWorkflow(readText(repoRoot, file) ?? '') : null;
  const findings = [];
  if (inScope(DEPENDABOT) && !hasDependabot(parsed(DEPENDABOT))) findings.push(found('HFS_DEPENDABOT_MISSING', DEPENDABOT, 'Declare Dependabot version 2 updates for npm, github-actions and docker, each with a directory and schedule.'));
  if (inScope(CI) && !hasAudit(stepsOf(parsed(CI)))) findings.push(found('HFS_AUDIT_STEP_MISSING', CI, 'CI must run npm audit --omit=dev in an enabled step whose failure stops the job.'));
  if (inScope(IMAGES) && !imageEvidence(stepsOf(parsed(IMAGES)))) findings.push(found('HFS_SBOM_MISSING', IMAGES, 'The images workflow must generate an SBOM and provenance for its release images in enabled steps.'));
  return findings;
}
