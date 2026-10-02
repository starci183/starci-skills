import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = {
  bash: 'starci.bash',
  zsh: '_starci',
  fish: 'starci.fish',
  powershell: 'starci.ps1',
};

export const completionShells = Object.freeze(Object.keys(FILES));

export function completionFor(shell, { read = readFileSync } = {}) {
  const file = FILES[shell];
  if (!file) return null;
  return read(fileURLToPath(new URL(`../completions/${file}`, import.meta.url)), 'utf8');
}
