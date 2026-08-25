# `delivery/mission-resume` output

Return `ready` with one joined continuation receipt or `blocked`. No semantic body is returned.

## JSON architecture

`state` declares the resume emission; `produced` contains only the continuation receipt, while `context` names its inputs. `cleanup` purges scratch refs at `skill-terminal`.
