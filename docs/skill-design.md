# Skill design and compatibility

## Packaging model

StarCi ships one `SKILL.md` with `name: starci` and a description stating capability and activation context. Its Node runtime, schemas and selected knowledge references travel in the same package. npm installs it under a folder named `starci`; the host installer deliberately places the runtime in `.claude` and uses explicit bootstrap links. That host layout is an integration adapter, **not native skill auto-discovery**.

Do not upload only `SKILL.md`: its relative references and executable helpers would be missing. Do not advertise this npm archive as a universally uploadable Claude/ChatGPT skill ZIP. A native skill export would need a `starci/` root and validation for the target host, including Node, filesystem and cross-repository access. No global skill installation or platform plugin is created by this installer.

## Authoring decisions

Anthropic's [skills repository](https://github.com/anthropics/skills) and the [Agent Skills specification](https://agentskills.io/specification) inform the frontmatter and self-contained resource structure. The specification requires a skill's name to match its native skill directory; the explicit host adapter above is why `.claude/SKILL.md` should not be described as such a discovered directory.

Following Anthropic's [authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), keep the entry focused on routing and material constraints, then load only relevant workflow/operator/knowledge references. Use deterministic scripts for fragile consistency checks. The description handles discovery; it does not need to enumerate every operator. More prose is not proof of better behavior: test realistic requests, stale evidence, invalid scope and failed handoffs.

Human installation/release explanations belong in README and docs, not the agent's mandatory context. No source grants an agent permission to change runtime, deploy or accept its own work; StarCi's actual user-approved scope and host permissions still apply.

For Codex, the official [AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) explains instruction discovery. StarCi keeps a small host entry pointing to the one runtime; a task opened outside that host receives its context explicitly. The paired `CLAUDE.md` is the corresponding Claude Code bootstrap, not a separate copy of workflow policy. Claude Code's [memory documentation](https://code.claude.com/docs/en/memory) describes `CLAUDE.md` loading and distinguishes instructions from enforced controls.

## Validation limits

Frontmatter checks and passing unit tests establish syntax and tested invariants. They do not demonstrate automatic selection in every host, model quality, browser UAT, or compatibility with a hosted API environment. Test the installed archive in an isolated host, then evaluate real project outcomes before treating an alpha as production-ready.
