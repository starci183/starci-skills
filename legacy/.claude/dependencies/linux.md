# Linux setup

Select tools from the [dependency catalog](README.md). Linux distributions have different package
managers, package names and supported releases. Use the documentation for the actual distribution;
do not treat a command for Ubuntu as a universal Linux installer.

## Install

- Install a maintained Node.js release through [Node.js downloads and installation options](https://nodejs.org/en/download). Check the version rather than assuming a distribution package satisfies the project and browser requirements.
- Follow [Git's Linux installation guide](https://git-scm.com/install/linux).
- For schema development, follow [Python on Unix platforms](https://docs.python.org/3/using/unix.html); the distribution may package virtual-environment support separately.
- Install ripgrep through its [distribution-specific options](https://github.com/BurntSushi/ripgrep#installation).

Verify in the same environment where the agent runs:

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

If environment creation fails because the distribution omits `venv`, install the matching system
package using that distribution's instructions. Keep Python package installs inside the environment.

## Workflow-specific tools

For containers, use the supported distribution instructions from
[Docker Engine](https://docs.docker.com/engine/install/) or choose Docker Desktop through the main
catalog. Check `docker version` as the actual execution user. Do not change socket permissions or
grant broad host access just to make a readiness check pass.

Follow [GitHub CLI's Linux instructions](https://github.com/cli/cli#installation) for workflows using
`gh`. For Playwright, install the browser and required OS libraries using the selected version's
[official instructions](https://playwright.dev/docs/intro), within the registry-defined host package
and browser cache. Confirm the distribution, architecture and installed Node version are supported.
Run a browser launch against the target; executable presence alone is insufficient.
