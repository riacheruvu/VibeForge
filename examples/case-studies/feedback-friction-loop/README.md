# Case Study: Feedback Friction Loop

This public-safe case study shows the core VibeCheckBench loop:

1. Start with interaction friction.
2. Turn it into reviewed test cases.
3. Compare a baseline local setup against one focused instruction change.
4. Gate the candidate on a final unseen check before trusting it.

The example uses synthetic conversation exports and captured local outputs. It
does not call hosted APIs and does not require a model download.

```bash
node skills/vibecheckbench/scripts/mine-conversation-history.mjs \
  --input examples/case-studies/feedback-friction-loop/conversation-export.json \
  --out reports/case-studies/feedback-friction-loop/history-review.json \
  --tasks-dir reports/case-studies/feedback-friction-loop/draft-tasks

node skills/vibecheckbench/scripts/promote-history-candidates.mjs \
  --review reports/case-studies/feedback-friction-loop/history-review.json \
  --decisions examples/case-studies/feedback-friction-loop/review-decisions.json \
  --out reports/case-studies/feedback-friction-loop/project.json \
  --tasks-dir reports/case-studies/feedback-friction-loop/tasks \
  --name "Feedback friction fit"

node skills/vibecheckbench/scripts/score-answers.mjs \
  --input examples/case-studies/feedback-friction-loop/captured-answers.train.json \
  --out reports/case-studies/feedback-friction-loop/results.train.json

node skills/vibecheckbench/scripts/score-answers.mjs \
  --input examples/case-studies/feedback-friction-loop/captured-answers.heldout.json \
  --out reports/case-studies/feedback-friction-loop/results.heldout.json

node skills/vibecheckbench/scripts/gate-config-results.mjs \
  --train reports/case-studies/feedback-friction-loop/results.train.json \
  --heldout reports/case-studies/feedback-friction-loop/results.heldout.json \
  --out reports/case-studies/feedback-friction-loop/config-gate.json
```

The gate output is deliberately conservative: a pass means the candidate is
worth human review, not that the setup should be deployed automatically.
