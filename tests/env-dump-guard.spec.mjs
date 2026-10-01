import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { commandVerdict } from '../scripts/guards/command-guard.mjs';

// The command guard refuses a command that writes the WHOLE environment to output, even when a grep or a sed follows:
// the AWS, Azure and Anthropic values reached a transcript through `env | grep -i orca | sed ...`. Reading one named
// variable, setting a variable for a command and shell options pass. No command below is ever run.
const cwd = os.tmpdir();
const verdict = (command, dialect = 'bash') => commandVerdict({ command, cwd, guard: { owned: null }, env: process.env, dialect });

test('a whole-environment dump is refused in every spelling, filtered or not, in bash and PowerShell', async () => {
  const refused = [
    ["env | grep -i orca | sed -E 's/(TOKEN|SECRET|KEY)=.*/\\1=***/' ; cd ../c0-wlist && grep -n x file", 'bash'],
    ['env', 'bash'],
    ['env | sort', 'bash'],
    ['env | grep -i token', 'bash'],
    ['env -u HOME', 'bash'],
    ['echo "$(env)"', 'bash'],
    ['bash -c "env | grep AWS"', 'bash'],
    ['printenv', 'bash'],
    ['printenv | grep -i key', 'bash'],
    ['printenv -0', 'bash'],
    ['set', 'bash'],
    ['set | findstr TOKEN', 'bash'],
    ['set | grep KEY', 'bash'],
    ['export -p', 'bash'],
    ['export', 'bash'],
    ['declare -x', 'bash'],
    ['declare -p', 'bash'],
    ['declare -xp', 'bash'],
    ['cmd /c set', 'bash'],
    ['cmd //c set', 'bash'],
    ['cmd /c "set | findstr KEY"', 'bash'],
    ['set', 'cmd'],
    ['Get-ChildItem env:', 'powershell'],
    ['gci env:', 'powershell'],
    ['dir env:', 'powershell'],
    ['ls env:', 'powershell'],
    ['Get-ChildItem Env:\\', 'powershell'],
    ['Get-ChildItem -Path env:', 'powershell'],
    ['Get-Item env:*', 'powershell'],
    ['Get-ChildItem env: | Where-Object { $_.Name -match "KEY" }', 'powershell'],
    ['gci env: | Format-Table -AutoSize', 'powershell'],
    ['[Environment]::GetEnvironmentVariables()', 'powershell'],
    ['[System.Environment]::GetEnvironmentVariables()', 'powershell'],
    ['$all = [System.Environment]::GetEnvironmentVariables(); $all', 'powershell'],
    ['[Environment]::GetEnvironmentVariables("Machine")', 'powershell'],
    ['printenv', 'powershell'],
    ['node -e "console.log(process.env)"', 'bash'],
    ['node -e "console.log(JSON.stringify(process.env))"', 'bash'],
    ['node -e "console.log(JSON.stringify(process.env, null, 2))"', 'bash'],
    ['node -p "process.env"', 'bash'],
    ['node -p "JSON.stringify(process.env)"', 'bash'],
    ['node -e "Object.entries(process.env).forEach(([k, v]) => console.log(k, v))"', 'bash'],
    ['node -e "process.stdout.write(JSON.stringify(process.env))"', 'bash'],
    ['node -e "console.log(process.env)"', 'powershell'],
    ['python -c "import os; print(os.environ)"', 'bash'],
    ['python -c "import os; print(dict(os.environ))"', 'bash'],
    ['python3 -c "import os, json; print(json.dumps(dict(os.environ)))"', 'bash'],
    ['python -c "import os\nfor k, v in os.environ.items(): print(k, v)"', 'bash'],
  ];
  for (const [command, dialect] of refused) {
    const v = await verdict(command, dialect);
    assert.equal(v?.code, 'ENV_DUMP', `${command} (${dialect}) -> ${v?.code ?? 'passed'}`);
    assert.match(v.remedy, /read only the one named, non-secret variable you need.*never dump the environment/);
  }
});

test('reading one named variable, setting a variable for a command, shell options and mere mentions pass', async () => {
  const passed = [
    ['echo $PATH', 'bash'],
    ['echo "$HOME"', 'bash'],
    ['printenv HOME', 'bash'],
    ['printenv HOME PATH', 'bash'],
    ['echo %PATH%', 'bash'],
    ['echo %PATH%', 'cmd'],
    ['$env:PATH', 'powershell'],
    ['Write-Host $env:USERPROFILE', 'powershell'],
    ['Get-ChildItem env:PATH', 'powershell'],
    ['Get-Item env:HOME', 'powershell'],
    ['[Environment]::GetEnvironmentVariable("HOME")', 'powershell'],
    ['ls', 'powershell'],
    ['dir C:\\temp', 'powershell'],
    ['node -e "console.log(process.env.HOME)"', 'bash'],
    ['node -p "process.env.HOME"', 'bash'],
    ['node -e "console.log(process.env[\'HOME\'])"', 'bash'],
    ['node -e "require(\'child_process\').spawnSync(\'x\', { env: { ...process.env, A: \'1\' } })"', 'bash'],
    ['python -c "import os; print(os.environ[\'HOME\'])"', 'bash'],
    ['python -c "import os; print(os.environ.get(\'HOME\'))"', 'bash'],
    ['env VAR=x node a.mjs', 'bash'],
    ['env -u VAR node a.mjs', 'bash'],
    ['env -i PATH=/bin sh -c "echo hi"', 'bash'],
    ['FOO=1 node a.mjs', 'bash'],
    ['set -e', 'bash'],
    ['set -euo pipefail', 'bash'],
    ['set -x; npm test', 'bash'],
    ['set -o pipefail', 'bash'],
    ['export FOO=bar', 'bash'],
    ['export FOO=bar && node a.mjs', 'bash'],
    ['declare -p MYVAR', 'bash'],
    ['declare -a arr', 'bash'],
    ['declare -f myfn', 'bash'],
    ['Set-Variable x 1', 'powershell'],
    ['set x 1', 'powershell'],
    ['echo "env | grep KEY and printenv and set and Get-ChildItem env:"', 'bash'],
    ['Write-Host "Get-ChildItem env: and [Environment]::GetEnvironmentVariables()"', 'powershell'],
    ['echo "node -e console.log(process.env)"', 'bash'],
    ['git log --grep="never run env | grep TOKEN or printenv"', 'bash'],
    ['git log --grep="$(cat <<\'EOF\'\nguard: refuse env | grep and set | findstr\n\nGet-ChildItem env: is refused\nEOF\n)"', 'bash'],
    ["cat <<'EOF' > note.md\nenv | sed s/KEY/x/\nEOF", 'bash'],
    ['# env | grep TOKEN\nGet-Date', 'powershell'],
    ['grep -rn printenv docs', 'bash'],
  ];
  for (const [command, dialect] of passed) {
    const v = await verdict(command, dialect);
    assert.equal(v, null, `${command} (${dialect}) -> ${v?.code}`);
  }
});

test('a relative path that ends in env or printenv is a file, not the program', async () => {
  for (const command of ['runtime/env', 'cat runtime/env | head', 'cd x && ./bin/printenv', '.starcistacks/app/runtime/env']) assert.equal(await verdict(command), null, command);
  assert.equal((await verdict('/usr/bin/env | sort'))?.code, 'ENV_DUMP');
  assert.equal((await verdict(path.join(cwd, 'printenv.exe'), 'powershell'))?.code, 'ENV_DUMP');
});
