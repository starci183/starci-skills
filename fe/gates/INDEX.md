# Five frontend gates — temporary test root

This root makes the five reasoning shelves visible as one ordered chain while their consumption
model is being tested. It changes where the canon lives; it does **not** yet make a skill execute
every gate or produce a five-gate receipt.

| Order | Gate | Question | Home |
|---:|---|---|---|
| 1 | layouts | Which page-level arrangement owns the regions? | [`layouts/`](layouts/) |
| 2 | blocks | Which product blocks and states inhabit those regions? | [`blocks/`](blocks/) |
| 3 | principles | Which closed visual and structural facts constrain the arrangement? | [`principles/`](principles/) |
| 4 | patterns | Which source shape expresses the approved plan? | [`patterns/`](patterns/) |
| 5 | lints | Which machine rules prove the source did not escape the plan? | [`lints/`](lints/) |

The chain is directional:

```text
prompt / image / feedback
  -> layouts
  -> blocks
  -> principles
  -> patterns
  -> lints
  -> code
```
