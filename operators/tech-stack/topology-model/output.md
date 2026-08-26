# `tech-stack/topology-model` output

## JSON architecture

`state` is the machine-routing decision. `produced` returns stackModelRef, stackModelSha256 as immutable session references, with context lineage, evidence and findings. Scratch state is purged at the parent skill-terminal after any required handoff acknowledgement.
