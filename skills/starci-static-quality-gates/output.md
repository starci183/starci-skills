# starci-static-quality-gates output

Return one terminal result bound to an exact machine terminal through `state.status`, `state.code`, and `state.terminalState`. Return only immutable receipt references and bounded evidence-linked findings. Set `handoffRef` to the validated session handoff artifact only for a handoff result; otherwise set it to `null`. `cleanup` always purges task-session scratch at the skill terminal.
