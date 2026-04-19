# Quantum transmutation API — science validity and risks

This document applies to the `/api/quantum/*` routes and related simulation code under `extensions/mud/src/quantum/`. It is **not** peer-reviewed physics guidance.

## Validity (what this is not)

- **Macroscopic quantum tunneling of food, soil, or humans** in the sense of bulk matter rearranging via a Schrödinger barrier is **not** an established engineering capability. These APIs implement **deterministic and stochastic simulations** for creative tooling, narrative, and software integration tests.
- **GPS, pressure, and “field uniformity” scores** are computed from simplified spherical geodesy and toy exponential atmospheres. They are **not** substitutes for meteorology, radiation transport, or planetary science models.
- **Household counter-spectra** uses nonnegative least squares (NNLS) over a hand-authored material table. That is a **curve-fit metaphor**, not identification of real samples from spectra.
- **Stable-element one-mole table** uses conventional atomic weights for pedagogical mass bookkeeping in simulation. It does not certify chemical purity, isotopic composition, or handling safety.

## `fieldStabilization` (boolean)

- The flag is an **operational gate in software**: when `false`, endpoints that accept an optional `zoneId` refuse transmutation/tunneling-style operations (HTTP 422) unless a documented **development override** is enabled.
- **`true` does not mean a physical quantum field has been measured or stabilized.** It only means the simulation path that models dampeners / field scoring is allowed to proceed.

## Misrepresentation risk

- Downstream UIs or voice agents must label outputs as **simulated** or **fictional** where end users might otherwise infer laboratory or medical meaning.
- **Nutrition, soil fertility, and “conversion” results** are generated from toy analyzers and must not be used for dietary, agricultural, or safety decisions without replacing them with validated models and measurements.

## Operational and privacy risks

- **LLM zone advisor** (optional): camera or scene descriptions and contextual text may be sent to third-party models. Review provider terms, logging, retention, and regional privacy rules. Use environment keys (`OPENAI_API_KEY`, optional `OPENAI_ZONE_MODEL`) with least privilege.
- **Location data**: requests may include GPS and altitude. Treat logs and crash dumps as **sensitive** if they store coordinates.
- **Cost and rate limits**: LLM and external APIs can incur charges; add throttling in production deployments.

## Biological and mechanical safety (narrative vs reality)

- **Proximity / human–animal structs** are for simulation of “keep-out” reasoning only. They do **not** detect people in the real world and must not be used for machine safeguarding.
- **Transmutation zones** nested under a safety envelope remain **data structures**. They do not create containment in the physical world.

## Development override

- Query `?devOverride=1` is honored **only** when the environment variable `QUANTUM_DEV_OVERRIDE=1` is set on the server. Do not enable in production unless you accept the loss of the stabilization gate.

## References in-repo

- Implications narrative (fiction): [quantum-teleportation-implications.md](./quantum-teleportation-implications.md)
- HTTP surface: see `extensions/mud/README.md` (Quantum API section).
