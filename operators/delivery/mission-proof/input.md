# `delivery/mission-proof` input

Join the complete frontend product proof with the backend delivery proof when `backend-impact-required` is present. A frontend-only mission must carry the signed impact receipt proving that no backend contract changed.

## JSON architecture

- `provided` carries the mission, impact, FE product-proof and optional backend-proof refs.
- `loads` resolves each declared proof and routed head at runtime.
- `session` keeps joined evidence private until the parent skill terminal.
