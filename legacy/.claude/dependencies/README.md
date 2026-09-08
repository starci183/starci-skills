# Dependencies

This directory explains the host tools needed to run the skills. Use the guide for
[Windows](windows.md), [macOS](macos.md), or [Linux](linux.md). These are installation and verification
guides, not declarations that tools are already installed or permission to operate external systems.

`dependencies` includes language runtimes, command-line tools and workflow-specific services. Reserve
`plugins` for actual extensions to an agent host; a plugin is one possible dependency, not the name
for Node.js, Git, Python or Docker.

## Baseline for repository execution

| Dependency | Needed for | Installation source | Verification |
| --- | --- | --- | --- |
| Agent host with file and shell access | Reading the skill and executing authorized work | The selected host's supported installation; use the capabilities actually available in that session | Confirm file and shell tools are callable |
| Node.js and npm | Running the existing `.mjs` runtime, installer and validators | [Node.js downloads](https://nodejs.org/en/download) | `node --version`, `npm --version` |
| Git | Source inspection, commits and publication workflows | [Git installation](https://git-scm.com/install/) | `git --version` |
| ripgrep, recommended | Fast source/file discovery | [ripgrep installation](https://github.com/BurntSushi/ripgrep#installation) | `rg --version` |

Use a maintained Node.js LTS release satisfying the package's `engines.node` and the chosen tool's
requirements. The package minimum alone does not establish compatibility with a newer browser tool.
An explanation-only task does not require installing the complete execution toolchain.

## Build and contract development

| Dependency | Needed for | Installation source | Verification |
| --- | --- | --- | --- |
| Python 3.10 or newer | Running `scripts/build.py`, the Python tests and `scripts/validate_operator.py` | [Python platform setup](https://docs.python.org/3/using/index.html) | `python --version` on Windows, `python3 --version` on macOS/Linux |
| Python JSON Schema validator | Testing authored schemas and validating operator records | `tests/requirements-schema.txt` in this repository | Run `python scripts/test_foundation.py` after building the bundles |

The bundle builder uses the Python standard library. Consuming the generated JSON bundle does not
require Python; the consuming application provides its own compatible validator. The supplied
operator workflows select `scripts/validate_operator.py`, which requires Python and the
pinned `jsonschema[format]` dependency in `tests/requirements-schema.txt`. Install requirements
into the selected skill environment, not an unrelated product environment.

## Install only for the selected workflow

| Dependency or capability | When needed | Installation and readiness |
| --- | --- | --- |
| Playwright and its Chromium binary | The workflow selects the existing Playwright browser runner | [Playwright installation](https://playwright.dev/docs/intro); use the host package location and browser cache declared by `resources/tools.json`, `tools.browsercontrol.install` |
| Docker Engine or Docker Desktop, with Compose when declared | Container-backed services, builds or release work | [Docker installation](https://docs.docker.com/get-started/get-docker/); `docker version` must reach the engine, not merely find the CLI |
| GitHub CLI | A workflow uses GitHub CI or repository operations through `gh` | [GitHub CLI installation](https://github.com/cli/cli#installation); check `gh --version` and `gh auth status` |
| Project package manager and database/storage clients | The selected repository or route declares them | Follow its `packageManager`, lockfile, runtime declarations and client documentation |
| Browser control, image generation, connectors or other host plugins | The selected skill requires that capability | Check the active host's tool availability and account connection; an installed executable alone cannot provide these capabilities |

Keep actual tool-mode grants in `resources/tools.json` and operator assignments. These guides do not
duplicate their closed registry. Provider credentials stay in their existing credential store; do not
record tokens or passwords here. Installing a tool does not authorize deployments, publication,
database changes or account actions.

An OS guide describes setup, not certification that every workflow runs on every OS. Verify the
chosen tool's supported OS version/architecture and the real target service before declaring readiness.
