# `tech-stack/constraint-publish` output

## JSON architecture

`state` is the machine-routing decision. `produced` returns techStackHeadRef, techStackHeadSha256 as immutable session references, with context lineage, evidence and findings. Scratch state is purged at the parent skill-terminal after any required handoff acknowledgement.
