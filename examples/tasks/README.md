# VibeForge Task Pack

This folder contains public-safe task definitions for preference-fit evaluation.

The goal is to make each check concrete enough to run repeatedly, while still
measuring user-fit behaviors that normal benchmarks tend to flatten away.

Each task defines:

- `id`: stable task id
- `category`: user-fit area, such as `pushback_fit` or `decision_fit`
- `preference_id`: matching preference/rubric id used by charts
- `grading.mode`: `deterministic`, `llm_judge`, or `hybrid`
- `hard_checks`: lightweight checks that can run without a judge model
- `judge_rubric`: softer criteria for a separate judge model
- `scoring`: weights for deterministic and judge components
- `input.prompt`: a single user turn, or
- `input.turns`: a multi-turn chat ending with the user turn to evaluate
- `provenance`: optional source, review state, and synthetic/redaction metadata
- `workflow`: optional expected/forbidden tool calls for future trace-aware grading

Conversation-derived tasks should remain `needs_review` until a person confirms
that they are durable, privacy-safe preferences rather than accidental features
of one conversation.

Design principle:

> Test whether the setup helps this kind of user, not whether the base model is
> globally "best."

For v0, VibeForge can export these tasks to Promptfoo. Promptfoo handles
provider execution and reports; VibeForge owns the task taxonomy, public
examples, rubrics, and user-fit charting.
