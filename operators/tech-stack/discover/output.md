# `tech-stack/discover` output

## JSON architecture

`state` is the machine-routing decision. `produced` returns inventoryRef, inventorySha256 as immutable session references, with context lineage, evidence and findings. Scratch state is purged at the parent skill-terminal after any required handoff acknowledgement.
