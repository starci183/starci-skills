# macOS setup

Select the tools needed for the workflow from the [dependency catalog](README.md). Use installers
or your established package manager for the machine's architecture; verify the actual binaries the
agent's shell resolves.

## Install

- Install Node.js and npm from [Node.js downloads](https://nodejs.org/en/download).
- Follow [Git's macOS installation guide](https://git-scm.com/install/mac).
- For schema development, follow [Python on macOS](https://docs.python.org/3/using/mac.html).
- Install ripgrep using its [macOS installation options](https://github.com/BurntSushi/ripgrep#installation).

In a new terminal:

```sh
node --version
npm --version
git --version
rg --version
python3 --version
```

## Develop the schemas

Run from this source repository:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements-schema.txt
.venv/bin/python scripts/build.py
.venv/bin/python scripts/test_build_schema.py
.venv/bin/python scripts/test_works_schema.py
```

## Workflow-specific tools

Use [Docker's macOS installation guide](https://docs.docker.com/desktop/setup/install/mac-install/)
when containers are needed; select the appropriate Apple silicon or Intel package. Check
`docker version` after starting the engine. GitHub workflows may additionally need
[GitHub CLI](https://github.com/cli/cli#installation).

For Playwright, use the registry-defined host package and browser cache. Set
`PLAYWRIGHT_BROWSERS_PATH` in the shell before calling that installed package's CLI. Verify that
the selected Playwright version supports this macOS release, then launch its Chromium against the
actual target. A desktop browser permission or plugin must be checked through the agent host.
