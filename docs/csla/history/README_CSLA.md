# CSLA

## Cognitive State Learning Architecture

CSLA is a research and product architecture for long-horizon AI agents that learn from consequences rather than only generating language.

Core loop:

```text
Observation
  -> Task Model
  -> Memory / World Model / Reasoning
  -> Prediction
  -> Action
  -> Outcome
  -> Error
  -> Causal Credit
  -> Selective Update
  -> Replay
  -> Consolidation
  -> Better Future State
```

## Main specification

See [`CSLA_v1_2_COMPLETE_SPEC.md`](./CSLA_v1_2_COMPLETE_SPEC.md).

## Codex instructions

See [`AGENTS_CSLA.md`](./AGENTS_CSLA.md).

## Product direction

The initial commercial product is an auditable long-horizon AI execution layer with persistent experience memory, provider-neutral LLM adapters, tool/MCP integration, recovery, and outcome-driven learning.

The architecture is designed to support OpenAI, Anthropic, Gemini and other providers through a common adapter interface; MCP is the preferred standard for composable tools/resources when applicable.

## Important boundary

CSLA is a computational research hypothesis. It does not claim consciousness or a one-to-one reproduction of the human brain.
