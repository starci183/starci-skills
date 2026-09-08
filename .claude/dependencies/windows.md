# Windows setup

Select the required tools from the [dependency catalog](README.md). Use a native PowerShell session
for a native Windows host. If the agent actually runs inside WSL, follow the Linux guide inside that
distribution; Windows-installed binaries do not establish Linux readiness.

## Install

- Install the matching Windows architecture from [Node.js](https://nodejs.org/en/download), including npm.
- Install [Git for Windows](https://git-scm.com/install/windows) and make Git available on PATH.
- For schema development, follow [Python on Windows](https://docs.python.org/3/using/windows.html).
- For faster source searches, follow [ripgrep's Windows installation options](https://github.com/BurntSushi/ripgrep#installation).

Open a new shell after an installer changes PATH, then verify:

```powershell
node --version
npm.cmd --version
git --version
rg --version
python --version
```

`npm.cmd` selects the executable command shim when PowerShell's script policy does not allow
`npm.ps1`. A working `py` launcher may select Python if `python` is unavailable; verify the selected
interpreter's version before using it.

## Develop the schemas

Run from this source repository. A local environment avoids changing the project's Python packages;
invoking its interpreter directly needs no activation script.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r tests/requirements-schema.txt
.\.venv\Scripts\python.exe scripts/build.py
.\.venv\Scripts\python.exe scripts/test_build_schema.py
.\.venv\Scripts\python.exe scripts/test_works_schema.py
```

## Workflow-specific tools

Use [Docker's Windows guide](https://docs.docker.com/desktop/setup/install/windows-install/) when
containers are required. Start the engine and check `docker version`; use `docker compose version`
only when the workflow declares Compose. Install [GitHub CLI](https://github.com/cli/cli#installation)
only for a workflow using `gh`.

For the Playwright runner, resolve its host paths from the catalog's registry reference. Set the
browser cache with PowerShell's `$env:PLAYWRIGHT_BROWSERS_PATH` syntax before invoking the installed
Playwright CLI. Confirm the package, browser binary and target page can all be opened. A globally
installed browser or a different user's cache does not prove the configured runner is ready.
