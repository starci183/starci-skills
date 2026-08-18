---
title: Ollama embedding setup
runtime: true
source: en.md
sourceHash: 6740c54fd9913460468ba5417269c344b66bbc0ea14f34c310d97a0181fb907d
contextVersion: 1
---

# Ollama embedding setup

## LOADS

None.

## Inspect before choosing

Choose the model before the first index. Record system RAM, GPU model and VRAM, then check whether Ollama is
already installed and which models are resident:

```text
ollama --version
ollama list
ollama ps
```

On Windows, use `Get-CimInstance Win32_ComputerSystem`, `Get-CimInstance Win32_Processor` and
`nvidia-smi --query-gpu=name,memory.total --format=csv,noheader`. On Linux use `free -h`, `lscpu` and
`nvidia-smi`; on Apple silicon use `system_profiler SPHardwareDataType`. Report measured facts before the
recommendation. Shared VRAM, other models and Docker services count against the available budget.

## Recommendation profiles

Prefer the Qwen3 embedding family for StarCi source because one family covers multilingual prose and code.
Use model size as a practical deployment tier, not as a guarantee of retrieval quality:

| Machine | Default recommendation | Pull size | Native embedding length | Trade-off |
|---|---|---:|---:|---|
| CPU-only, 8–16 GB RAM, or under 4 GB free VRAM | `qwen3-embedding:0.6b` | about 639 MB | inspect with `ollama show` | fastest and cheapest; lower retrieval depth |
| 4–6 GB free VRAM, or 16–32 GB RAM with CPU fallback | `qwen3-embedding:4b` | about 2.5 GB | inspect with `ollama show` | balanced latency and code retrieval |
| at least 8 GB VRAM and 32 GB RAM | `qwen3-embedding:8b` | about 4.7 GB | 4096 | best quality tier; highest indexing latency and memory pressure |

If the machine runs databases, SonarQube or another LLM concurrently, choose one tier lower when `ollama ps`
shows substantial CPU spill or the GPU is close to full. For the current StarCi machine—i7-14700KF, 64 GB
RAM and RTX 5060 8 GB—the 8B Q4 model is supported and observed at about 89% GPU / 11% CPU; 4B is the
latency-first alternative.

`nomic-embed-text` is a small 274 MB / 768-dimension fallback for very constrained machines, but it has a
shorter context and is not the default for multilingual source catalogs. Do not select a chat/generation
model merely because Ollama can run it; the model must advertise the `embedding` capability.

## Install and verify

Install Ollama from `https://ollama.com/download`, start its local service, then pull exactly the selected tag:

```text
ollama pull qwen3-embedding:0.6b
ollama pull qwen3-embedding:4b
ollama pull qwen3-embedding:8b
```

Pull one chosen model, not all three, unless the owner explicitly wants comparison data. Run
`ollama show <model>` and record its `embedding length`. Warm it with one `/api/embed` request to
`http://localhost:11434`, assert that one non-empty vector returns, then inspect `ollama ps` for actual
CPU/GPU placement. Docker reaches the host service through `http://host.docker.internal:11434`; Ollama is
never a public tunnel origin.

## Model lock

Index and query must use the identical model tag, vector name and dimension. Qdrant collection schema fixes
that dimension. Changing any of them requires a complete rebuild of the source-context collection and every
routed partition; never mix vectors from two models in one collection or merely change the MCP query model.
Because the index is rebuildable, keep no manual points and perform the rebuild only after the exact affected
partitions are known.

The packaged StarCi profile is `qwen3-embedding:8b` at 4096 dimensions. A lower profile must be configured
before the first `setup`; changing an existing profile is a separately reported rebuild, not an in-place
upgrade.
