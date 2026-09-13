# CSLA Codex Agent Instructions

This repository implements the Cognitive State Learning Architecture (CSLA).

## Source of truth

Read `CSLA_v1_2_COMPLETE_SPEC.md` before changing architecture.

## Non-negotiable rules

- Theory first, implementation second.
- Do not collapse CSLA into `LLM -> prompt -> tool -> LLM`.
- Keep State, Memory, World Model, Policy, Meta-Control, Credit, Replay and Consolidation as independently testable components.
- Keep provider-specific LLM code behind `LLMProvider`.
- Preserve event provenance and state versions.
- No persistent learning side effects without an explicit credit/update event.
- Do not enable real-world high-risk actions by default.
- Every new research mechanism requires an experiment/ablation plan.
- If code reveals a mathematical ambiguity, stop at the interface boundary and record the issue in `docs/design_notes/` rather than silently changing the theory.

## Preferred development order

1. contracts and schemas;
2. runtime/state machine;
3. LLM adapters;
4. memory;
5. tools/MCP;
6. world model;
7. credit assignment;
8. replay/consolidation;
9. meta-control;
10. benchmarks;
11. production service layer.

## Testing principle

Every cognitive state transition must be testable as:

`input state + event + action -> next state + ledger event`

Every learned module must expose a deterministic test mode with fixed seeds where technically possible.
